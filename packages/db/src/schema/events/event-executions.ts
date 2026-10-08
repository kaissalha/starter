import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { timeFields } from "../helpers/time.ts";
import { events } from "./events.ts";

export const eventConsumerKinds = ["builtin"] as const;

export type EventConsumerKind = (typeof eventConsumerKinds)[number];

export const eventExecutionStates = [
	"queued",
	"running",
	"retry_wait",
	"succeeded",
	"skipped",
	"failed",
	"cancelled",
	"unknown",
] as const;

export type EventExecutionState = (typeof eventExecutionStates)[number];

export const eventExecutions = pgTable(
	"event_executions",
	{
		attemptCount: integer("attempt_count").default(0).notNull(),
		availableAt: timestamp("available_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		completedAt: timestamp("completed_at", { mode: "string", withTimezone: true }),
		consumerKey: text("consumer_key").notNull(),
		consumerKind: text("consumer_kind").$type<EventConsumerKind>().notNull(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		expectedBy: timestamp("expected_by", { mode: "string", withTimezone: true }),
		id: uuid("id").defaultRandom().primaryKey(),
		nextAttemptAt: timestamp("next_attempt_at", { mode: "string", withTimezone: true }),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		outcomeCode: text("outcome_code"),
		startRequestedAt: timestamp("start_requested_at", { mode: "string", withTimezone: true }),
		state: text("state").$type<EventExecutionState>().default("queued").notNull(),
		workflowRunId: text("workflow_run_id"),
		...timeFields,
	},
	(table) => [
		uniqueIndex("event_executions_event_consumer_unique").on(table.eventId, table.consumerKey),
		index("event_executions_open_idx")
			.on(table.state, table.availableAt)
			.where(sql`${table.state} in ('queued', 'running', 'retry_wait')`),
		index("event_executions_organization_kind_created_idx").on(
			table.organizationId,
			table.consumerKind,
			table.createdAt
		),
	]
);

export type EventExecutionRecord = typeof eventExecutions.$inferSelect;
