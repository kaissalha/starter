import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	db,
	eventDispatches,
	eventExecutions,
	events,
	oauthAccessTokens,
	oauthClients,
	oauthConsents,
	sessions,
	verifications,
} from "@starter/db";

vi.mock("workflow/api", () => ({ getRun: vi.fn(), start: vi.fn() }));

import { deleteInBatches, pruneExpiredAuthRecords, pruneStaleOAuthClients } from "../../src/services/data-retention";
import { runEventRetention } from "../../src/services/events/dispatch";
import { cleanupTestActors, createTestTeam } from "../helpers/db";

const cleanupIds: Array<string> = [];

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const hoursAhead = (hours: number) => hoursAgo(-hours);

afterEach(async () => {
	vi.useRealTimers();
	await cleanupTestActors(cleanupIds);
});

describe("deleteInBatches", () => {
	it("stops once a batch is not full and sums every batch", async () => {
		const deleteBatch = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(10).mockResolvedValueOnce(3);
		expect(await deleteInBatches({ batchSize: 10, deleteBatch })).toEqual({ complete: true, deleted: 23 });
		expect(deleteBatch).toHaveBeenCalledTimes(3);
	});

	it("stops incomplete when the budget is spent", async () => {
		vi.useFakeTimers();

		const deleteBatch = vi.fn(async () => {
			vi.advanceTimersByTime(40);

			return 10;
		});

		expect(await deleteInBatches({ batchSize: 10, budgetMs: 100, deleteBatch })).toEqual({
			complete: false,
			deleted: 30,
		});
	});
});

describe("data retention", () => {
	it(
		"deletes day-old events in batches but keeps recent, open-execution and undispatched events",
		{ timeout: 30_000 },
		async () => {
			const { organizationId } = await createTestTeam({ cleanupIds, name: "Retention events" });

			const event = (recordedAt: string) => ({
				actor: { type: "system" as const },
				correlationId: randomUUID(),
				data: {},
				id: randomUUID(),
				organizationId,
				producerKey: randomUUID(),
				recordedAt,
				rootEventId: randomUUID(),
				source: "system" as const,
				subjectId: randomUUID(),
				subjectType: "test",
				type: "test.created",
			});

			const old = Array.from({ length: 2500 }, () => event(hoursAgo(25)));
			const recent = event(hoursAgo(1));
			const open = event(hoursAgo(25));
			const pending = event(hoursAgo(25));
			await db.insert(events).values([...old, recent, open, pending]);
			await db.insert(eventDispatches).values({ eventId: pending.id, organizationId });
			await db.insert(eventExecutions).values({
				consumerKey: "builtin:notifications",
				consumerKind: "builtin",
				eventId: open.id,
				organizationId,
				state: "running",
			});

			expect(await runEventRetention()).toMatchObject({ complete: true });

			const remaining = await db
				.select({ id: events.id })
				.from(events)
				.where(eq(events.organizationId, organizationId));

			expect(remaining.map(({ id }) => id).toSorted()).toEqual([recent.id, open.id, pending.id].toSorted());
		}
	);

	it("removes only auth records past their cutoff", async () => {
		const { owner } = await createTestTeam({ cleanupIds, name: "Retention auth" });
		const clientId = randomUUID();
		await db.insert(oauthClients).values({ clientId, id: clientId, redirectUris: [] });
		const ids = { expired: randomUUID(), grace: randomUUID(), live: randomUUID() };
		await db.insert(verifications).values([
			{ expiresAt: hoursAgo(25), id: ids.expired, identifier: "retention", value: "x" },
			{ expiresAt: hoursAgo(1), id: ids.grace, identifier: "retention", value: "x" },
			{ expiresAt: hoursAhead(1), id: ids.live, identifier: "retention", value: "x" },
		]);
		await db.insert(sessions).values([
			{ expiresAt: hoursAgo(25), id: ids.expired, token: randomUUID(), userId: owner.userId },
			{ expiresAt: hoursAgo(1), id: ids.grace, token: randomUUID(), userId: owner.userId },
			{ expiresAt: hoursAhead(1), id: ids.live, token: randomUUID(), userId: owner.userId },
		]);
		await db.insert(oauthAccessTokens).values([
			{ clientId, expiresAt: hoursAgo(1), id: ids.expired, scopes: [], token: randomUUID() },
			{ clientId, expiresAt: hoursAhead(1), id: ids.live, scopes: [], token: randomUUID() },
		]);

		await pruneExpiredAuthRecords();
		const allIds = Object.values(ids);

		const remaining = async (table: typeof oauthAccessTokens | typeof sessions | typeof verifications) =>
			(await db.select({ id: table.id }).from(table).where(inArray(table.id, allIds)))
				.map(({ id }) => id)
				.toSorted();

		expect(await remaining(verifications)).toEqual([ids.grace, ids.live].toSorted());
		expect(await remaining(sessions)).toEqual([ids.grace, ids.live].toSorted());
		expect(await remaining(oauthAccessTokens)).toEqual([ids.live]);
		await db.delete(oauthClients).where(eq(oauthClients.clientId, clientId));
	});

	it("purges only old anonymous OAuth clients without tokens or consents", async () => {
		const { owner } = await createTestTeam({ cleanupIds, name: "Retention clients" });

		const client = (overrides: { createdAt: string; userId?: string }) => {
			const clientId = randomUUID();

			return { clientId, id: clientId, redirectUris: [], ...overrides };
		};

		const stale = client({ createdAt: hoursAgo(25) });
		const consented = client({ createdAt: hoursAgo(25) });
		const owned = client({ createdAt: hoursAgo(25), userId: owner.userId });
		const recent = client({ createdAt: hoursAgo(1) });
		await db.insert(oauthClients).values([stale, consented, owned, recent]);
		await db.insert(oauthConsents).values({ clientId: consented.clientId, id: randomUUID(), scopes: [] });

		await pruneStaleOAuthClients();
		const clientIds = [stale, consented, owned, recent].map(({ clientId }) => clientId);

		const remaining = await db
			.select({ clientId: oauthClients.clientId })
			.from(oauthClients)
			.where(inArray(oauthClients.clientId, clientIds));

		expect(remaining.map(({ clientId }) => clientId).toSorted()).toEqual(
			[consented.clientId, owned.clientId, recent.clientId].toSorted()
		);
		await db.delete(oauthClients).where(inArray(oauthClients.clientId, clientIds));
	});
});
