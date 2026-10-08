import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";

export type EventActor =
	| { apiKeyId: string; type: "api_key"; userId: string }
	| { ruleId: string; type: "automation"; userId: string }
	| { type: "system" }
	| { type: "user"; userId: string }
	| { type: "visitor" };

export const eventSources = ["api", "automation", "chat", "dashboard", "mcp", "system", "website", "workflow"] as const;

export type EventSource = (typeof eventSources)[number];

export type EventDataValue = boolean | null | number | string | Array<string>;

export type EventData = { [key: string]: EventDataValue };

export const events = pgTable(
	"events",
	{
		actor: jsonb("actor").$type<EventActor>().notNull(),
		causationId: uuid("causation_id"),
		correlationId: uuid("correlation_id").notNull(),
		data: jsonb("data").$type<EventData>().notNull(),
		depth: integer("depth").default(0).notNull(),
		id: uuid("id").primaryKey(),
		occurredAt: timestamp("occurred_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		producerKey: text("producer_key").notNull(),
		recordedAt: timestamp("recorded_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		rootEventId: uuid("root_event_id").notNull(),
		source: text("source").$type<EventSource>().notNull(),
		subjectId: text("subject_id").notNull(),
		subjectRevision: text("subject_revision"),
		subjectType: text("subject_type").notNull(),
		type: text("type").notNull(),
		version: integer("version").default(1).notNull(),
	},
	(table) => [
		uniqueIndex("events_organization_producer_key_unique").on(table.organizationId, table.producerKey),
		index("events_recorded_idx").on(table.recordedAt),
	]
);

export type EventRecord = typeof events.$inferSelect;
