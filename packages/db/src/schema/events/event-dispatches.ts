import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { events } from "./events.ts";

export const eventDispatches = pgTable(
	"event_dispatches",
	{
		attempts: integer("attempts").default(0).notNull(),
		availableAt: timestamp("available_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		eventId: uuid("event_id")
			.primaryKey()
			.references(() => events.id, { onDelete: "cascade" }),
		expandedAt: timestamp("expanded_at", { mode: "string", withTimezone: true }),
		lastErrorCode: text("last_error_code"),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("event_dispatches_pending_idx")
			.on(table.availableAt)
			.where(sql`${table.expandedAt} is null`),
		index("event_dispatches_organization_idx").on(table.organizationId),
	]
);
