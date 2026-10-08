import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, events, notificationEmailDeliveries, notifications } from "@starter/db";

import type { sendEmail as SendEmail } from "../../src/lib/resend";
import { cleanupTestActors, createTestTeam } from "../helpers/db";

vi.mock("workflow/api", () => ({ getRun: vi.fn(), start: vi.fn(async () => ({ runId: "run" })) }));

vi.mock("../../src/services/events/catalog", async () => {
	const { z } = await import("zod");
	const data = z.looseObject({});

	const eventCatalog = {
		"test.created": { data, subjectType: "test" },
		"test.locked": { data, subjectType: "test" },
		"test.other": { data, subjectType: "test" },
	};

	return { eventCatalog, isEventType: (type: string) => type in eventCatalog };
});

vi.mock("../../src/services/notifications/registry", () => {
	const base = { category: "test", groupKey: "groupId", showInSettings: true };

	const notificationTypes = {
		test_created: {
			...base,
			email: { audience: "writers", locked: false },
			event: "test.created",
			inApp: { audience: "members", locked: false },
			order: 1,
		},
		test_locked: {
			...base,
			email: null,
			event: "test.locked",
			inApp: { audience: "members", locked: true },
			order: 2,
		},
	};

	return {
		audiencePermission: (audience: string) => (audience === "writers" ? "write" : "read"),
		getNotificationDefinition: (type: keyof typeof notificationTypes) => notificationTypes[type],
		isNotificationType: (type: string) => type in notificationTypes,
		notificationCategories: ["test"],
		notificationTypeKeys: Object.keys(notificationTypes),
		notificationTypes,
	};
});

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn<typeof SendEmail>() }));

vi.mock("../../src/lib/resend", () => ({ sendEmail }));

import { appendEvents } from "../../src/services/events/append";
import { sendNotificationEmails } from "../../src/services/notifications/email";
import {
	archiveAllNotifications,
	archiveNotifications,
	countNotifications,
	listNotifications,
	markNotificationsRead,
	markNotificationsSeen,
} from "../../src/services/notifications/inbox";
import {
	getNotificationSettings,
	notificationSettingUpdateSchema,
	updateNotificationSetting,
} from "../../src/services/notifications/preferences";
import { projectNotificationEvent } from "../../src/services/notifications/projector";

const cleanupIds: Array<string> = [];

const createTeam = () => createTestTeam({ cleanupIds, name: "Inbox test" });

const recordEvent = async ({ organizationId, type = "test.created" }: { organizationId: string; type?: string }) => {
	const subjectId = randomUUID();

	const [eventId] = await db.transaction((transaction) =>
		appendEvents({
			events: [{ actor: { type: "system" }, data: { groupId: subjectId }, subject: { id: subjectId }, type }],
			organizationId,
			source: "system",
			transaction,
		})
	);

	const [row] = await db
		.select()
		.from(events)
		.where(eq(events.id, eventId ?? ""));

	if (!row) {
		throw new Error("Missing event");
	}

	return row;
};

const notify = async ({ organizationId }: { organizationId: string }) => {
	const event = await recordEvent({ organizationId });

	return { event, outcome: await projectNotificationEvent({ event }) };
};

afterEach(async () => {
	await cleanupTestActors(cleanupIds);
});

describe("notification projection", () => {
	it("notifies every member once per event with ordered per-inbox sequences", async () => {
		const team = await createTeam();
		const first = await notify({ organizationId: team.organizationId });
		expect(first.outcome).toEqual({ code: "projected", state: "succeeded" });
		expect(await projectNotificationEvent({ event: first.event })).toEqual({
			code: "no_recipients",
			state: "skipped",
		});
		await notify({ organizationId: team.organizationId });

		const rows = await db
			.select({
				groupKey: notifications.groupKey,
				recipient: notifications.recipientUserId,
				sequence: notifications.sequence,
			})
			.from(notifications)
			.where(eq(notifications.organizationId, team.organizationId));

		expect(rows).toHaveLength(6);
		expect(rows.some(({ groupKey }) => groupKey === first.event.subjectId)).toBe(true);

		for (const actor of [team.owner, team.admin, team.member]) {
			expect(
				rows
					.filter(({ recipient }) => recipient === actor.userId)
					.map(({ sequence }) => sequence)
					.toSorted()
			).toEqual([1, 2]);
		}
	});

	it("skips members who turned the type off and events without a notification type", async () => {
		const team = await createTeam();
		await updateNotificationSetting({
			actor: team.member,
			input: notificationSettingUpdateSchema.parse({ channel: "in_app", enabled: false, type: "test_created" }),
		});
		await notify({ organizationId: team.organizationId });
		expect(await countNotifications({ actor: team.member })).toEqual({ unseen: 0 });
		expect(await countNotifications({ actor: team.owner })).toEqual({ unseen: 1 });

		const [settings] = await getNotificationSettings({ actor: team.member });
		expect(settings).toMatchObject({ channels: [{ channel: "in_app", enabled: false, locked: false }] });

		const other = await recordEvent({ organizationId: team.organizationId, type: "test.other" });
		expect(await projectNotificationEvent({ event: other })).toEqual({ code: "not_applicable", state: "skipped" });
	});
});

describe("inbox", () => {
	it("lists, pages and counts only the recipient's own rows", async () => {
		const team = await createTeam();
		const other = await createTeam();
		await notify({ organizationId: team.organizationId });
		await notify({ organizationId: team.organizationId });
		await notify({ organizationId: other.organizationId });

		const first = await listNotifications({ actor: team.owner, input: { limit: 1 } });
		expect(first.items).toHaveLength(1);
		expect(first.items[0]).toMatchObject({ sequence: 2, type: "test_created" });
		expect(first.newestSequence).toBe(2);
		expect(first.nextCursor).toBe(2);

		const second = await listNotifications({
			actor: team.owner,
			input: { cursor: first.nextCursor ?? 0, limit: 1 },
		});

		expect(second.items.map(({ sequence }) => sequence)).toEqual([1]);
		expect(second.nextCursor).toBeNull();

		expect(await countNotifications({ actor: team.owner })).toEqual({ unseen: 2 });
		const otherIds = (await listNotifications({ actor: other.owner, input: {} })).items.map(({ id }) => id);
		expect(await archiveNotifications({ actor: team.owner, input: { ids: otherIds } })).toEqual({ updated: 0 });
		expect(
			await markNotificationsRead({ actor: team.admin, input: { ids: first.items.map(({ id }) => id) } })
		).toEqual({
			updated: 0,
		});
	});

	it("marks seen and archives only through the sequence the client showed", async () => {
		const team = await createTeam();
		await notify({ organizationId: team.organizationId });
		const shown = await listNotifications({ actor: team.owner, input: {} });
		await notify({ organizationId: team.organizationId });

		expect(
			await markNotificationsSeen({ actor: team.owner, input: { throughSequence: shown.newestSequence ?? 0 } })
		).toEqual({
			unseen: 1,
		});
		expect(
			await archiveAllNotifications({ actor: team.owner, input: { throughSequence: shown.newestSequence ?? 0 } })
		).toEqual({
			updated: 1,
		});

		const inbox = await listNotifications({ actor: team.owner, input: {} });
		expect(inbox.items.map(({ sequence }) => sequence)).toEqual([2]);
		const archived = await listNotifications({ actor: team.owner, input: { tab: "archive" } });
		expect(archived.items.map(({ sequence }) => sequence)).toEqual([1]);
		expect(archived.items[0]?.seenAt).toBeTruthy();

		const [row] = inbox.items;
		await markNotificationsRead({ actor: team.owner, input: { ids: [row?.id ?? ""] } });

		const [read] = await db
			.select({ readAt: notifications.readAt, seenAt: notifications.seenAt })
			.from(notifications)
			.where(and(eq(notifications.id, row?.id ?? ""), eq(notifications.recipientUserId, team.owner.userId)));

		expect(read?.readAt).toBeTruthy();
		expect(read?.seenAt).toBeTruthy();
		expect(await countNotifications({ actor: team.owner })).toEqual({ unseen: 0 });
	});
});

describe("notification settings", () => {
	it("offers the email channel to writers and rejects locked or unavailable channels", async () => {
		const team = await createTeam();
		const owner = await getNotificationSettings({ actor: team.owner });
		expect(owner.map(({ type }) => type)).toEqual(["test_created", "test_locked"]);
		expect(owner[0]?.channels).toEqual([
			{ channel: "in_app", enabled: true, locked: false },
			{ channel: "email", enabled: true, locked: false },
		]);
		const member = await getNotificationSettings({ actor: team.member });
		expect(member[0]?.channels).toEqual([{ channel: "in_app", enabled: true, locked: false }]);

		const updated = await updateNotificationSetting({
			actor: team.owner,
			input: notificationSettingUpdateSchema.parse({ channel: "email", enabled: false, type: "test_created" }),
		});

		expect(updated.channels.find(({ channel }) => channel === "email")?.enabled).toBe(false);
		await expect(
			updateNotificationSetting({
				actor: team.owner,
				input: notificationSettingUpdateSchema.parse({
					channel: "in_app",
					enabled: false,
					type: "test_locked",
				}),
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			updateNotificationSetting({
				actor: team.owner,
				input: notificationSettingUpdateSchema.parse({ channel: "email", enabled: false, type: "test_locked" }),
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("notification email", () => {
	beforeEach(() => {
		sendEmail.mockReset();
		sendEmail.mockResolvedValue("email-id");
		vi.stubEnv("VERCEL_ENV", "production");
		vi.stubEnv("EVENTS_EXTERNAL_DELIVERY", "");
	});
	afterEach(() => vi.unstubAllEnvs());

	it("sends nothing outside production unless external delivery is enabled", async () => {
		const team = await createTeam();
		const event = await recordEvent({ organizationId: team.organizationId });
		vi.stubEnv("VERCEL_ENV", "preview");

		expect(await sendNotificationEmails({ event })).toEqual({ code: "delivery_disabled", state: "skipped" });
		expect(sendEmail).not.toHaveBeenCalled();
		expect(
			await db.select().from(notificationEmailDeliveries).where(eq(notificationEmailDeliveries.eventId, event.id))
		).toEqual([]);
	});

	it("skips events without an email notification type", async () => {
		const team = await createTeam();

		for (const type of ["test.locked", "test.other"]) {
			const event = await recordEvent({ organizationId: team.organizationId, type });
			expect(await sendNotificationEmails({ event })).toEqual({ code: "not_applicable", state: "skipped" });
		}

		expect(sendEmail).not.toHaveBeenCalled();
	});
});
