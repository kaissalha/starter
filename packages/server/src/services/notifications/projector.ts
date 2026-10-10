import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
	db,
	members,
	notificationInboxes,
	notificationPreferences,
	notifications,
	users,
	type EventData,
	type EventRecord,
	type NotificationChannel,
} from "@starter/db";

import { hasOrganizationPermission } from "../../utils/permissions";
import { audiencePermission, getNotificationDefinition, notificationTypeKeys, type NotificationType } from "./registry";

const groupKeySchema = z.string();

export type ProjectionOutcome = { code: string; state: "skipped" | "succeeded" };

export const findNotificationRecipients = async ({
	channel,
	event,
	executor = db,
	type,
}: {
	channel: NotificationChannel;
	event: EventRecord;
	executor?: Pick<typeof db, "select">;
	type: NotificationType;
}) => {
	const definition =
		channel === "email" ? getNotificationDefinition(type).email : getNotificationDefinition(type).inApp;

	const actor = "userId" in event.actor ? event.actor.userId : null;

	const candidates = await executor
		.select({
			email: users.email,
			enabled: notificationPreferences.enabled,
			role: members.role,
			userId: members.userId,
		})
		.from(members)
		.innerJoin(users, eq(users.id, members.userId))
		.leftJoin(
			notificationPreferences,
			and(
				eq(notificationPreferences.organizationId, members.organizationId),
				eq(notificationPreferences.userId, members.userId),
				eq(notificationPreferences.type, type),
				eq(notificationPreferences.channel, channel)
			)
		)
		.where(eq(members.organizationId, event.organizationId))
		.orderBy(asc(members.userId));

	return candidates.filter(
		({ enabled, role, userId }) =>
			definition !== null &&
			userId !== actor &&
			(definition.locked || enabled !== false) &&
			hasOrganizationPermission({ permission: audiencePermission(definition.audience), role })
	);
};

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
		const candidates = await findNotificationRecipients({ channel: "in_app", event, executor: transaction, type });

		const existing = await transaction
			.select({ userId: notifications.recipientUserId })
			.from(notifications)
			.where(and(eq(notifications.eventId, event.id), eq(notifications.type, type)));

		const recipients = candidates
			.filter(({ userId }) => !existing.some((row) => row.userId === userId))
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

export const projectNotificationEvent = async ({ event }: { event: EventRecord }): Promise<ProjectionOutcome> => {
	const type = notificationTypeKeys.find((candidate) => getNotificationDefinition(candidate).event === event.type);

	if (!type) {
		return { code: "not_applicable", state: "skipped" };
	}

	const groupKey =
		groupKeySchema.safeParse(event.data[getNotificationDefinition(type).groupKey]).data ?? event.subjectId;

	return insertNotifications({
		event,
		groupKey,
		params: event.data,
		subject: { id: event.subjectId, type: event.subjectType },
		type,
	});
};
