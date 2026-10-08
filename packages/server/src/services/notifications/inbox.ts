import { and, count, desc, eq, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { contacts, db, notifications } from "@starter/db";

import { isNotificationType, notificationTypeKeys } from "./registry";

export type NotificationActor = { organizationId: string; userId: string };

const notificationIdsSchema = z.array(z.uuid()).min(1).max(100);

const sequenceSchema = z.int().positive();

export const notificationListInputSchema = z
	.strictObject({
		cursor: sequenceSchema.optional(),
		limit: z.int().min(1).max(20).default(20),
		tab: z.enum(["archive", "inbox"]).default("inbox"),
	})
	.meta({ id: "ListNotificationsInput" });

export const notificationIdsInputSchema = z
	.strictObject({ ids: notificationIdsSchema })
	.meta({ id: "NotificationIds" });

export const notificationSequenceInputSchema = z
	.strictObject({ throughSequence: sequenceSchema })
	.meta({ id: "NotificationSequenceBound" });

export const notificationSchema = z
	.strictObject({
		archivedAt: z.string().nullable(),
		contact: z.strictObject({ email: z.string().nullable(), id: z.uuid(), name: z.string().nullable() }).nullable(),
		createdAt: z.string(),
		groupKey: z.string().nullable(),
		id: z.uuid(),
		params: z.record(z.string(), z.union([z.boolean(), z.null(), z.number(), z.string(), z.array(z.string())])),
		readAt: z.string().nullable(),
		resolvedAt: z.string().nullable(),
		seenAt: z.string().nullable(),
		sequence: z.int(),
		subject: z.strictObject({ id: z.string(), type: z.string() }),
		type: z.enum(notificationTypeKeys),
	})
	.meta({ id: "Notification" });

export const notificationListResultSchema = z
	.strictObject({
		items: z.array(notificationSchema),
		newestSequence: sequenceSchema.nullable(),
		nextCursor: sequenceSchema.nullable(),
	})
	.meta({ id: "NotificationList" });

export const notificationCountsSchema = z.strictObject({ unseen: z.int() }).meta({ id: "NotificationCounts" });

export const notificationUpdateResultSchema = z
	.strictObject({ updated: z.int() })
	.meta({ id: "NotificationUpdateResult" });

const scope = (actor: NotificationActor) =>
	and(
		eq(notifications.organizationId, actor.organizationId),
		eq(notifications.recipientUserId, actor.userId),
		inArray(notifications.type, notificationTypeKeys)
	);

export const listNotifications = async ({
	actor,
	input,
}: {
	actor: NotificationActor;
	input: z.input<typeof notificationListInputSchema>;
}) => {
	const { cursor, limit, tab } = notificationListInputSchema.parse(input);

	const rows = await db
		.select({
			archivedAt: notifications.archivedAt,
			createdAt: notifications.createdAt,
			groupKey: notifications.groupKey,
			id: notifications.id,
			params: notifications.params,
			readAt: notifications.readAt,
			resolvedAt: notifications.resolvedAt,
			seenAt: notifications.seenAt,
			sequence: notifications.sequence,
			subjectId: notifications.subjectId,
			subjectType: notifications.subjectType,
			type: notifications.type,
		})
		.from(notifications)
		.where(
			and(
				scope(actor),
				tab === "archive" ? isNotNull(notifications.archivedAt) : isNull(notifications.archivedAt),
				cursor === undefined ? undefined : lt(notifications.sequence, cursor)
			)
		)
		.orderBy(desc(notifications.sequence))
		.limit(limit + 1);

	const page = rows.slice(0, limit);

	const contactIds = [
		...new Set(
			page.flatMap(({ groupKey, type }) => (type === "contact_message_received" && groupKey ? [groupKey] : []))
		),
	];

	const contactRows =
		contactIds.length === 0
			? []
			: await db
					.select({ email: contacts.email, id: contacts.id, name: contacts.name })
					.from(contacts)
					.where(and(eq(contacts.organizationId, actor.organizationId), inArray(contacts.id, contactIds)));

	return {
		items: page.flatMap(({ subjectId, subjectType, type, ...row }) =>
			isNotificationType(type)
				? [
						{
							...row,
							contact: contactRows.find(({ id }) => id === row.groupKey) ?? null,
							subject: { id: subjectId, type: subjectType },
							type,
						},
					]
				: []
		),
		newestSequence: cursor === undefined ? (page[0]?.sequence ?? null) : null,
		nextCursor: rows.length > limit ? (page.at(-1)?.sequence ?? null) : null,
	};
};

export const countNotifications = async ({ actor }: { actor: NotificationActor }) => {
	const [row] = await db
		.select({ unseen: count() })
		.from(notifications)
		.where(and(scope(actor), isNull(notifications.seenAt), isNull(notifications.archivedAt)));

	return { unseen: row?.unseen ?? 0 };
};

export const markNotificationsSeen = async ({
	actor,
	input,
}: {
	actor: NotificationActor;
	input: z.input<typeof notificationSequenceInputSchema>;
}) => {
	const { throughSequence } = notificationSequenceInputSchema.parse(input);
	await db
		.update(notifications)
		.set({ seenAt: sql`now()` })
		.where(and(scope(actor), isNull(notifications.seenAt), lte(notifications.sequence, throughSequence)));

	return countNotifications({ actor });
};

const updateNotifications = async ({
	actor,
	archive,
	ids,
}: {
	actor: NotificationActor;
	archive: boolean;
	ids: Array<string>;
}) => {
	const updated = await db
		.update(notifications)
		.set({
			...(archive
				? { archivedAt: sql`coalesce(${notifications.archivedAt}, now())` }
				: { readAt: sql`coalesce(${notifications.readAt}, now())` }),
			seenAt: sql`coalesce(${notifications.seenAt}, now())`,
		})
		.where(and(scope(actor), inArray(notifications.id, ids)))
		.returning({ id: notifications.id });

	return { updated: updated.length };
};

export const markNotificationsRead = ({
	actor,
	input,
}: {
	actor: NotificationActor;
	input: z.input<typeof notificationIdsInputSchema>;
}) => updateNotifications({ actor, archive: false, ids: notificationIdsInputSchema.parse(input).ids });

export const archiveNotifications = ({
	actor,
	input,
}: {
	actor: NotificationActor;
	input: z.input<typeof notificationIdsInputSchema>;
}) => updateNotifications({ actor, archive: true, ids: notificationIdsInputSchema.parse(input).ids });

export const archiveAllNotifications = async ({
	actor,
	input,
}: {
	actor: NotificationActor;
	input: z.input<typeof notificationSequenceInputSchema>;
}) => {
	const { throughSequence } = notificationSequenceInputSchema.parse(input);

	const updated = await db
		.update(notifications)
		.set({ archivedAt: sql`now()`, seenAt: sql`coalesce(${notifications.seenAt}, now())` })
		.where(and(scope(actor), isNull(notifications.archivedAt), lte(notifications.sequence, throughSequence)))
		.returning({ id: notifications.id });

	return { updated: updated.length };
};
