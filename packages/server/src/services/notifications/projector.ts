import { and, asc, eq, isNull, sql } from "drizzle-orm";

import {
	contactMessages,
	db,
	members,
	notificationInboxes,
	notificationPreferences,
	notifications,
	type EventActor,
	type EventData,
	type EventRecord,
} from "@starter/db";

import { hasOrganizationPermission } from "../../utils/permissions";
import { eventCatalog } from "../events/catalog";
import { audiencePermission, notificationTypes, type NotificationType } from "./registry";

export type ProjectionOutcome = { code: string; state: "skipped" | "succeeded" };

const actorUserId = (actor: EventActor) => ("userId" in actor ? actor.userId : null);

const insertNotifications = ({
	event,
	groupKey,
	params,
	subject,
	type,
}: {
	event: EventRecord;
	groupKey: string;
	params: EventData;
	subject: { id: string; type: string };
	type: NotificationType;
}) =>
	db.transaction(async (transaction): Promise<ProjectionOutcome> => {
		const definition = notificationTypes[type];

		const candidates = await transaction
			.select({ enabled: notificationPreferences.enabled, role: members.role, userId: members.userId })
			.from(members)
			.leftJoin(
				notificationPreferences,
				and(
					eq(notificationPreferences.organizationId, members.organizationId),
					eq(notificationPreferences.userId, members.userId),
					eq(notificationPreferences.type, type),
					eq(notificationPreferences.channel, "in_app")
				)
			)
			.where(eq(members.organizationId, event.organizationId))
			.orderBy(asc(members.userId));

		const existing = await transaction
			.select({ userId: notifications.recipientUserId })
			.from(notifications)
			.where(and(eq(notifications.eventId, event.id), eq(notifications.type, type)));

		const actor = actorUserId(event.actor);

		const recipients = candidates
			.filter(
				({ enabled, role, userId }) =>
					userId !== actor &&
					(definition.inApp.locked || enabled !== false) &&
					hasOrganizationPermission({ permission: audiencePermission(definition.inApp.audience), role }) &&
					!existing.some((row) => row.userId === userId)
			)
			.map(({ userId }) => userId);

		if (recipients.length === 0) {
			return { code: "no_recipients", state: "skipped" };
		}

		const sequences = await transaction
			.insert(notificationInboxes)
			.values(recipients.map((userId) => ({ lastSequence: 1, organizationId: event.organizationId, userId })))
			.onConflictDoUpdate({
				set: { lastSequence: sql`${notificationInboxes.lastSequence} + 1` },
				target: [notificationInboxes.organizationId, notificationInboxes.userId],
			})
			.returning({ sequence: notificationInboxes.lastSequence, userId: notificationInboxes.userId });

		await transaction
			.insert(notifications)
			.values(
				sequences.map(({ sequence, userId }) => ({
					eventId: event.id,
					groupKey,
					organizationId: event.organizationId,
					params,
					recipientUserId: userId,
					sequence,
					subjectId: subject.id,
					subjectType: subject.type,
					type,
				}))
			)
			.onConflictDoNothing();

		return { code: "projected", state: "succeeded" };
	});

const projectContactMessage = async ({ event }: { event: EventRecord }): Promise<ProjectionOutcome> => {
	const data = eventCatalog["contact_message.created"].data.parse(event.data);

	const [message] = await db
		.select({ spamFlag: contactMessages.spamFlag })
		.from(contactMessages)
		.where(eq(contactMessages.id, data.messageId))
		.limit(1);

	if (!message) {
		return { code: "subject_deleted", state: "skipped" };
	}

	if (message.spamFlag) {
		return { code: "spam", state: "skipped" };
	}

	return insertNotifications({
		event,
		groupKey: data.contactId,
		params: { contactId: data.contactId, messageId: data.messageId, websiteId: data.websiteId },
		subject: { id: data.messageId, type: "contact_message" },
		type: "contact_message_received",
	});
};

const resolveSpamMessage = async ({ event }: { event: EventRecord }): Promise<ProjectionOutcome> => {
	const data = eventCatalog["contact_message.triaged"].data.parse(event.data);

	if (!data.spam) {
		return { code: "not_spam", state: "skipped" };
	}

	await db
		.update(notifications)
		.set({
			archivedAt: sql`coalesce(${notifications.archivedAt}, now())`,
			resolvedAt: sql`coalesce(${notifications.resolvedAt}, now())`,
			seenAt: sql`coalesce(${notifications.seenAt}, now())`,
		})
		.where(
			and(
				eq(notifications.organizationId, event.organizationId),
				eq(notifications.type, "contact_message_received"),
				eq(notifications.subjectId, data.messageId),
				isNull(notifications.readAt)
			)
		);

	return { code: "resolved_spam", state: "succeeded" };
};

const removeContactNotifications = async ({ event }: { event: EventRecord }): Promise<ProjectionOutcome> => {
	const data = eventCatalog["contact.deleted"].data.parse(event.data);
	await db
		.delete(notifications)
		.where(
			and(
				eq(notifications.organizationId, event.organizationId),
				eq(notifications.type, "contact_message_received"),
				eq(notifications.groupKey, data.contactId)
			)
		);

	return { code: "removed", state: "succeeded" };
};

const domainNotificationTypes = {
	"domain_registration.completed": "domain_registered",
	"domain_registration.expiring": "domain_expiring",
	"domain_registration.failed": "domain_registration_failed",
	"website_domain.connected": "domain_connected",
} as const satisfies Partial<Record<EventRecord["type"], NotificationType>>;

const isDomainNotificationEvent = (type: string): type is keyof typeof domainNotificationTypes =>
	type in domainNotificationTypes;

const projectDomainEvent = ({
	event,
	type,
}: {
	event: EventRecord;
	type: keyof typeof domainNotificationTypes;
}): Promise<ProjectionOutcome> => {
	const data = eventCatalog[type].data.parse(event.data);
	const groupKey = "registrationId" in data ? data.registrationId : data.domainId;

	return insertNotifications({
		event,
		groupKey,
		params: data,
		subject: { id: event.subjectId, type: event.subjectType },
		type: domainNotificationTypes[type],
	});
};

export const projectNotificationEvent = async ({ event }: { event: EventRecord }): Promise<ProjectionOutcome> => {
	if (event.type === "contact_message.created") {
		return projectContactMessage({ event });
	}

	if (event.type === "contact_message.triaged") {
		return resolveSpamMessage({ event });
	}

	if (event.type === "contact.deleted") {
		return removeContactNotifications({ event });
	}

	if (isDomainNotificationEvent(event.type)) {
		return projectDomainEvent({ event, type: event.type });
	}

	return { code: "not_applicable", state: "skipped" };
};
