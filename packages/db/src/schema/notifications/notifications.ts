import { sql } from "drizzle-orm";
import { bigint, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { users } from "../auth/users.ts";
import { events, type EventData } from "../events/events.ts";

export const notifications = pgTable(
	"notifications",
	{
		archivedAt: timestamp("archived_at", { mode: "string", withTimezone: true }),
		createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		groupKey: text("group_key"),
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		params: jsonb("params").$type<EventData>().notNull(),
		readAt: timestamp("read_at", { mode: "string", withTimezone: true }),
		recipientUserId: text("recipient_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		resolvedAt: timestamp("resolved_at", { mode: "string", withTimezone: true }),
		seenAt: timestamp("seen_at", { mode: "string", withTimezone: true }),
		sequence: bigint("sequence", { mode: "number" }).notNull(),
		subjectId: text("subject_id").notNull(),
		subjectType: text("subject_type").notNull(),
		type: text("type").notNull(),
	},
	(table) => [
		uniqueIndex("notifications_event_type_recipient_unique").on(table.eventId, table.type, table.recipientUserId),
		uniqueIndex("notifications_recipient_sequence_unique").on(
			table.organizationId,
			table.recipientUserId,
			table.sequence
		),
		index("notifications_unseen_idx")
			.on(table.organizationId, table.recipientUserId)
			.where(sql`${table.seenAt} is null and ${table.archivedAt} is null`),
		index("notifications_group_idx").on(table.organizationId, table.type, table.groupKey),
	]
);

export type NotificationRecord = typeof notifications.$inferSelect;
