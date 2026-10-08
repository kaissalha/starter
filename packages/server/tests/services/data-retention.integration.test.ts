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
	seoAnswerRuns,
	seoQuestions,
	sessions,
	verifications,
	websites,
	websiteVersions,
} from "@starter/db";
import { createWebsiteGenerationShell, selectWebsiteGenerationProfile } from "@starter/infinite-website/generation";

vi.mock("workflow/api", () => ({ getRun: vi.fn(), start: vi.fn() }));

import {
	deleteInBatches,
	pruneExpiredAuthRecords,
	pruneSeoAnswerRuns,
	pruneStaleOAuthClients,
	pruneWebsiteVersions,
} from "../../src/services/data-retention";
import { runEventRetention } from "../../src/services/events/dispatch";
import { splitPersistedWebsiteSite } from "../../src/services/websites/persistence";
import { cleanupTestActors, createTestTeam } from "../helpers/db";

const cleanupIds: Array<string> = [];

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const hoursAhead = (hours: number) => hoursAgo(-hours);

const createWebsite = async () => {
	const { organizationId, owner } = await createTestTeam({ cleanupIds, name: "Retention test" });
	const websiteId = randomUUID();
	const brief = { location: "Toronto", name: "Test", schemaVersion: 1 as const, type: "Design" };
	const profile = selectWebsiteGenerationProfile({ businessType: "Design" });

	const plan = {
		kind: "plan" as const,
		pages: (["home", "about", "services", "faq", "contact"] as const).map((pageKey) => ({
			description: pageKey,
			pageKey,
			title: pageKey,
		})),
		siteDescription: "Retention",
	};

	const { brand, document } = createWebsiteGenerationShell({
		brief,
		localizations: { byLocale: { en: plan }, defaultLocale: "en" },
		profile,
		websiteId,
	});

	await db.insert(websites).values({ brief, id: websiteId, locale: "en", organizationId });

	const version = splitPersistedWebsiteSite({
		site: { assetBindings: {}, brand, document, schemaVersion: 1, templateId: profile.templateId },
	});

	return { organizationId, owner, version, websiteId };
};

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
				subjectType: "contact",
				type: "contact.created",
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

	it("keeps the draft, the published version and the newest 20 versions", async () => {
		const { version, websiteId } = await createWebsite();

		const inserted = await db
			.insert(websiteVersions)
			.values(Array.from({ length: 30 }, (_, index) => ({ ...version, version: index + 1, websiteId })))
			.returning({ id: websiteVersions.id, version: websiteVersions.version });

		const byVersion = new Map(inserted.map((row) => [row.version, row.id]));
		await db
			.update(websites)
			.set({ draftVersionId: byVersion.get(2), publishedVersionId: byVersion.get(1) })
			.where(eq(websites.id, websiteId));

		await pruneWebsiteVersions();

		const kept = await db
			.select({ version: websiteVersions.version })
			.from(websiteVersions)
			.where(eq(websiteVersions.websiteId, websiteId));

		expect(kept.map((row) => row.version).toSorted((a, b) => a - b)).toEqual([
			1,
			2,
			...Array.from({ length: 20 }, (_, index) => index + 11),
		]);
		expect(await pruneWebsiteVersions()).toEqual({ complete: true, deleted: 0 });
	});

	it("keeps each question's latest run and runs from the last day up to five", async () => {
		const { organizationId, websiteId } = await createWebsite();

		const [busy, stale, fresh] = await db
			.insert(seoQuestions)
			.values(
				["Busy", "Stale", "Fresh"].map((question) => ({
					locale: "en" as const,
					organizationId,
					question,
					source: "custom" as const,
					websiteId,
				}))
			)
			.returning({ id: seoQuestions.id });

		if (!busy || !stale || !fresh) {
			throw new Error("Missing questions");
		}

		const run = (questionId: string, checkedAt: string) => ({
			checkedAt,
			mode: "sample" as const,
			organizationId,
			questionId,
			result: { brand: "Test", location: "Toronto", prompt: "Test", results: [] },
			websiteId,
		});

		await db
			.insert(seoAnswerRuns)
			.values([
				...Array.from({ length: 8 }, (_, index) => run(busy.id, hoursAgo(index + 1))),
				...Array.from({ length: 3 }, (_, index) => run(stale.id, hoursAgo(48 + index))),
				...Array.from({ length: 3 }, (_, index) => run(fresh.id, hoursAgo(index + 1))),
			]);

		await pruneSeoAnswerRuns();

		const kept = await db
			.select({ checkedAt: seoAnswerRuns.checkedAt, questionId: seoAnswerRuns.questionId })
			.from(seoAnswerRuns)
			.where(eq(seoAnswerRuns.organizationId, organizationId));

		const count = (questionId: string) => kept.filter((row) => row.questionId === questionId).length;
		expect([count(busy.id), count(stale.id), count(fresh.id)]).toEqual([5, 1, 3]);
	});

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
