import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	contactMessages,
	contacts,
	db,
	eventExecutions,
	events,
	notificationEmailDeliveries,
	notifications,
	websites,
} from "@starter/db";

import type { sendEmail as SendEmail } from "../../src/lib/resend";
import { cleanupTestActors, createTestTeam, findEventExecutionId } from "../helpers/db";

vi.mock("workflow/api", () => ({ getRun: vi.fn(), start: vi.fn(async () => ({ runId: "run" })) }));

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn<typeof SendEmail>() }));

vi.mock("../../src/lib/resend", () => ({ sendEmail }));

import { appendEvents, type AppendEventInput } from "../../src/services/events/append";
import { dispatchEvents } from "../../src/services/events/dispatch";
import { claimEventExecution, continueEventExecution } from "../../src/services/events/executions";
import { sendNotificationEmails } from "../../src/services/notifications/email";
import {
	archiveAllNotifications,
	archiveNotifications,
	countNotifications,
	listNotifications,
	markNotificationsRead,
	markNotificationsSeen,
} from "../../src/services/notifications/inbox";
import { getNotificationSettings, updateNotificationSetting } from "../../src/services/notifications/preferences";
import { projectNotificationEvent } from "../../src/services/notifications/projector";

const cleanupIds: Array<string> = [];

const createTeam = () => createTestTeam({ cleanupIds, name: "Inbox test" });

const recordEvent = async ({ event, organizationId }: { event: AppendEventInput; organizationId: string }) => {
	const [eventId] = await db.transaction((transaction) =>
		appendEvents({ events: [event], organizationId, source: "website", transaction })
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

const receiveMessage = async ({
	message: text = "Hello",
	organizationId,
	senderName = "Ada",
}: {
	message?: string;
	organizationId: string;
	senderName?: string;
}) => {
	const [contact] = await db
		.insert(contacts)
		.values({ email: `${randomUUID()}@example.com`, name: "Ada Lovelace", organizationId })
		.returning({ id: contacts.id });

	const [message] = await db
		.insert(contactMessages)
		.values({ contactId: contact?.id ?? "", message: text, sectionId: randomUUID(), senderName })
		.returning({ id: contactMessages.id });

	const contactId = contact?.id ?? "";
	const messageId = message?.id ?? "";

	const event = await recordEvent({
		event: {
			actor: { type: "visitor" },
			data: { contactId, messageId, sectionId: randomUUID(), websiteId: randomUUID() },
			subject: { id: messageId },
			type: "contact_message.created",
		},
		organizationId,
	});

	return { contactId, event, messageId, outcome: await projectNotificationEvent({ event }) };
};

const recordDomainEvent = ({
	organizationId,
	type,
}: {
	organizationId: string;
	type: "domain_registration.expiring" | "domain_registration.failed";
}) => {
	const registrationId = randomUUID();

	return recordEvent({
		event:
			type === "domain_registration.expiring"
				? {
						actor: { type: "system" },
						data: { days: 14, domain: "example.com", expiresAt: "2026-12-01", registrationId },
						subject: { id: registrationId },
						type,
					}
				: {
						actor: { type: "system" },
						data: { domain: "example.com", registrationId },
						subject: { id: registrationId },
						type,
					},
		organizationId,
	});
};

const emailedTo = () => sendEmail.mock.calls.map(([input]) => input.to).toSorted();

const teamEmails = (...actors: Array<{ userId: string }>) =>
	actors.map(({ userId }) => `${userId}@example.com`).toSorted();

afterEach(async () => {
	await cleanupTestActors(cleanupIds);
});

describe("notification projection", () => {
	it("notifies every member once per event with ordered per-inbox sequences", async () => {
		const team = await createTeam();
		const first = await receiveMessage({ organizationId: team.organizationId });
		expect(first.outcome).toEqual({ code: "projected", state: "succeeded" });
		expect(await projectNotificationEvent({ event: first.event })).toEqual({
			code: "no_recipients",
			state: "skipped",
		});
		await receiveMessage({ organizationId: team.organizationId });

		const rows = await db
			.select({ recipient: notifications.recipientUserId, sequence: notifications.sequence })
			.from(notifications)
			.where(eq(notifications.organizationId, team.organizationId));

		expect(rows).toHaveLength(6);

		for (const actor of [team.owner, team.admin, team.member]) {
			expect(
				rows
					.filter(({ recipient }) => recipient === actor.userId)
					.map(({ sequence }) => sequence)
					.toSorted()
			).toEqual([1, 2]);
		}
	});

	it("skips members who turned the type off and messages already flagged as spam", async () => {
		const team = await createTeam();
		await updateNotificationSetting({
			actor: team.member,
			input: { channel: "in_app", enabled: false, type: "contact_message_received" },
		});
		await receiveMessage({ organizationId: team.organizationId });
		expect(await countNotifications({ actor: team.member })).toEqual({ unseen: 0 });
		expect(await countNotifications({ actor: team.owner })).toEqual({ unseen: 1 });

		const [settings] = await getNotificationSettings({ actor: team.member });
		expect(settings).toMatchObject({ channels: [{ channel: "in_app", enabled: false, locked: false }] });

		const [contact] = await db
			.insert(contacts)
			.values({ name: "Spammer", organizationId: team.organizationId })
			.returning({ id: contacts.id });

		const [message] = await db
			.insert(contactMessages)
			.values({
				contactId: contact?.id ?? "",
				message: "Buy",
				sectionId: randomUUID(),
				senderName: "Spam",
				spamFlag: true,
			})
			.returning({ id: contactMessages.id });

		const spam = await recordEvent({
			event: {
				actor: { type: "visitor" },
				data: {
					contactId: contact?.id ?? "",
					messageId: message?.id ?? "",
					sectionId: randomUUID(),
					websiteId: randomUUID(),
				},
				subject: { id: message?.id ?? "" },
				type: "contact_message.created",
			},
			organizationId: team.organizationId,
		});

		expect(await projectNotificationEvent({ event: spam })).toEqual({ code: "spam", state: "skipped" });
	});

	it("resolves unread rows when triage marks the message as spam and removes rows for deleted contacts", async () => {
		const team = await createTeam();
		const received = await receiveMessage({ organizationId: team.organizationId });
		await markNotificationsRead({
			actor: team.owner,
			input: { ids: (await listNotifications({ actor: team.owner, input: {} })).items.map(({ id }) => id) },
		});

		const triaged = await recordEvent({
			event: {
				actor: { type: "system" },
				data: {
					category: "other",
					contactId: received.contactId,
					messageId: received.messageId,
					spam: true,
					urgency: "routine",
				},
				subject: { id: received.messageId, revision: new Date().toISOString() },
				type: "contact_message.triaged",
			},
			organizationId: team.organizationId,
		});

		await projectNotificationEvent({ event: triaged });

		const rows = await db
			.select({
				archivedAt: notifications.archivedAt,
				recipient: notifications.recipientUserId,
				resolvedAt: notifications.resolvedAt,
			})
			.from(notifications)
			.where(eq(notifications.organizationId, team.organizationId));

		expect(rows.find(({ recipient }) => recipient === team.owner.userId)).toMatchObject({
			archivedAt: null,
			resolvedAt: null,
		});
		expect(rows.find(({ recipient }) => recipient === team.member.userId)?.resolvedAt).toBeTruthy();

		const deleted = await recordEvent({
			event: {
				actor: { type: "user", userId: team.owner.userId },
				data: { contactId: received.contactId },
				subject: { id: received.contactId },
				type: "contact.deleted",
			},
			organizationId: team.organizationId,
		});

		await projectNotificationEvent({ event: deleted });
		expect(
			await db
				.select({ id: notifications.id })
				.from(notifications)
				.where(eq(notifications.organizationId, team.organizationId))
		).toEqual([]);
	});
});

describe("inbox", () => {
	it("lists, pages and counts only the recipient's own rows", async () => {
		const team = await createTeam();
		const other = await createTeam();
		await receiveMessage({ organizationId: team.organizationId });
		await receiveMessage({ organizationId: team.organizationId });
		await receiveMessage({ organizationId: other.organizationId });

		const first = await listNotifications({ actor: team.owner, input: { limit: 1 } });
		expect(first.items).toHaveLength(1);
		expect(first.items[0]).toMatchObject({
			contact: { name: "Ada Lovelace" },
			sequence: 2,
			type: "contact_message_received",
		});
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
		await receiveMessage({ organizationId: team.organizationId });
		const shown = await listNotifications({ actor: team.owner, input: {} });
		await receiveMessage({ organizationId: team.organizationId });

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
	it("offers the email channel to owners and admins and rejects locked or unavailable channels", async () => {
		const team = await createTeam();
		const owner = await getNotificationSettings({ actor: team.owner });
		expect(owner.find(({ type }) => type === "contact_message_received")?.channels).toEqual([
			{ channel: "in_app", enabled: true, locked: false },
			{ channel: "email", enabled: true, locked: false },
		]);
		const member = await getNotificationSettings({ actor: team.member });
		expect(member.find(({ type }) => type === "contact_message_received")?.channels).toEqual([
			{ channel: "in_app", enabled: true, locked: false },
		]);

		const updated = await updateNotificationSetting({
			actor: team.owner,
			input: { channel: "email", enabled: false, type: "contact_message_received" },
		});

		expect(updated.channels.find(({ channel }) => channel === "email")?.enabled).toBe(false);
		await expect(
			updateNotificationSetting({
				actor: team.owner,
				input: { channel: "email", enabled: false, type: "domain_registration_failed" },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			updateNotificationSetting({
				actor: team.owner,
				input: { channel: "email", enabled: false, type: "domain_connected" },
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

	it("emails owners and admins once with a reply-to and a deep link", async () => {
		const team = await createTeam();
		const { contactId, event } = await receiveMessage({ organizationId: team.organizationId });

		expect(await sendNotificationEmails({ event })).toEqual({ code: "email_accepted", state: "succeeded" });
		expect(emailedTo()).toEqual(teamEmails(team.owner, team.admin));
		const [contact] = await db.select({ email: contacts.email }).from(contacts).where(eq(contacts.id, contactId));

		for (const [input] of sendEmail.mock.calls) {
			expect(input).toMatchObject({ flow: "notification", replyTo: contact?.email });
			expect(input.idempotencyKey).toBeTruthy();
			expect(input.html).toContain("Ada");
			expect(input.html).toContain(`contact=${contactId}`);
		}

		expect(await sendNotificationEmails({ event })).toEqual({ code: "already_sent", state: "skipped" });
		expect(sendEmail).toHaveBeenCalledTimes(2);

		const deliveries = await db
			.select()
			.from(notificationEmailDeliveries)
			.where(eq(notificationEmailDeliveries.eventId, event.id));

		expect(deliveries).toHaveLength(2);
		expect(
			deliveries.every(({ acceptedAt, providerMessageId }) => acceptedAt && providerMessageId === "email-id")
		).toBe(true);
	});

	it("escapes and truncates visitor content", async () => {
		const team = await createTeam();
		const filler = "x".repeat(800);

		const { event } = await receiveMessage({
			message: `<script>alert(1)</script>${filler}`,
			organizationId: team.organizationId,
			senderName: "Ada\n<b>Bold</b>",
		});

		await sendNotificationEmails({ event });

		const [[input] = []] = sendEmail.mock.calls;
		expect(input?.html).toContain("&lt;script&gt;");
		expect(input?.html).not.toContain("<script>alert");
		expect(input?.html).not.toContain(filler);
		expect(input?.subject).toBe("New message from Ada <b>Bold</b>");
	});

	it("honors email preferences", async () => {
		const team = await createTeam();
		await updateNotificationSetting({
			actor: team.admin,
			input: { channel: "email", enabled: false, type: "contact_message_received" },
		});
		const { event } = await receiveMessage({ organizationId: team.organizationId });

		await sendNotificationEmails({ event });

		expect(emailedTo()).toEqual(teamEmails(team.owner));
	});

	it("retries only failed recipients with the same idempotency key", async () => {
		const team = await createTeam();
		const { event } = await receiveMessage({ organizationId: team.organizationId });
		sendEmail.mockRejectedValueOnce(new Error("provider down"));

		await expect(sendNotificationEmails({ event })).rejects.toThrow("1 notification emails failed");
		const [[failed] = []] = sendEmail.mock.calls;
		sendEmail.mockClear();

		expect(await sendNotificationEmails({ event })).toEqual({ code: "email_accepted", state: "succeeded" });
		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({ idempotencyKey: failed?.idempotencyKey, to: failed?.to });
	});

	it("sends nothing outside production unless external delivery is enabled", async () => {
		const team = await createTeam();
		const { event } = await receiveMessage({ organizationId: team.organizationId });
		vi.stubEnv("VERCEL_ENV", "preview");

		expect(await sendNotificationEmails({ event })).toEqual({ code: "delivery_disabled", state: "skipped" });
		expect(sendEmail).not.toHaveBeenCalled();
		expect(
			await db.select().from(notificationEmailDeliveries).where(eq(notificationEmailDeliveries.eventId, event.id))
		).toEqual([]);

		vi.stubEnv("EVENTS_EXTERNAL_DELIVERY", "1");
		expect(await sendNotificationEmails({ event })).toEqual({ code: "email_accepted", state: "succeeded" });
	});

	it("skips spam, deleted messages and unrelated events", async () => {
		const team = await createTeam();
		const spam = await receiveMessage({ organizationId: team.organizationId });
		await db.update(contactMessages).set({ spamFlag: true }).where(eq(contactMessages.id, spam.messageId));
		expect(await sendNotificationEmails({ event: spam.event })).toEqual({ code: "spam", state: "skipped" });

		const deleted = await receiveMessage({ organizationId: team.organizationId });
		await db.delete(contactMessages).where(eq(contactMessages.id, deleted.messageId));
		expect(await sendNotificationEmails({ event: deleted.event })).toEqual({
			code: "subject_deleted",
			state: "skipped",
		});

		const removed = await recordEvent({
			event: {
				actor: { type: "user", userId: team.owner.userId },
				data: { contactId: deleted.contactId },
				subject: { id: deleted.contactId },
				type: "contact.deleted",
			},
			organizationId: team.organizationId,
		});

		expect(await sendNotificationEmails({ event: removed })).toEqual({ code: "not_applicable", state: "skipped" });
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("writes in the website language", async () => {
		const english = await createTeam();
		await sendNotificationEmails({
			event: (await receiveMessage({ organizationId: english.organizationId })).event,
		});
		expect(sendEmail.mock.calls[0]?.[0].subject).toBe("New message from Ada");
		sendEmail.mockClear();

		const arabic = await createTeam();
		await db.insert(websites).values({
			brief: { location: "Toronto", name: "Test", schemaVersion: 1, type: "Design" },
			id: randomUUID(),
			locale: "ar",
			organizationId: arabic.organizationId,
		});
		await sendNotificationEmails({
			event: (await receiveMessage({ organizationId: arabic.organizationId })).event,
		});
		const [[input] = []] = sendEmail.mock.calls;
		expect(input?.subject.startsWith("رسالة جديدة من")).toBe(true);
		expect(input?.html).toContain('dir="rtl"');
		expect(input?.html).toContain("/ar/dashboard");
	});

	it("emails domain alerts, keeping failed registrations locked on", async () => {
		const team = await createTeam();

		const expiring = await recordDomainEvent({
			organizationId: team.organizationId,
			type: "domain_registration.expiring",
		});

		expect(await sendNotificationEmails({ event: expiring })).toEqual({
			code: "email_accepted",
			state: "succeeded",
		});
		expect(emailedTo()).toEqual(teamEmails(team.owner, team.admin));
		expect(sendEmail.mock.calls[0]?.[0].subject).toContain("example.com");
		sendEmail.mockClear();

		await expect(
			updateNotificationSetting({
				actor: team.admin,
				input: { channel: "email", enabled: false, type: "domain_registration_failed" },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		const failed = await recordDomainEvent({
			organizationId: team.organizationId,
			type: "domain_registration.failed",
		});

		await sendNotificationEmails({ event: failed });
		expect(emailedTo()).toEqual(teamEmails(team.owner, team.admin));
	});

	it("runs as a built-in event consumer", async () => {
		const team = await createTeam();
		const { event } = await receiveMessage({ organizationId: team.organizationId });
		await dispatchEvents({ eventIds: [event.id] });

		const executionId = await findEventExecutionId({
			consumerKey: "builtin:notification_email",
			organizationId: team.organizationId,
		});

		await claimEventExecution({ executionId, runId: "email-run" });
		await continueEventExecution({ executionId, runId: "email-run" });

		const [execution] = await db.select().from(eventExecutions).where(eq(eventExecutions.id, executionId));
		expect(execution).toMatchObject({ outcomeCode: "email_accepted", state: "succeeded" });
	});
});
