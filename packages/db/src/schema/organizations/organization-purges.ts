import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";

export const organizationPurges = pgTable(
	"organization_purges",
	{
		attempts: integer("attempts").notNull().default(0),
		blobs: jsonb("blobs").$type<Array<{ access: "private" | "public"; key: string }>>().notNull().default([]),
		completedAt: timestamp("completed_at", { mode: "string", withTimezone: true }),
		lastError: text("last_error"),
		organizationId: text("organization_id").primaryKey(),
		...timeFields,
	},
	(table) => [
		index("organization_purges_pending_idx")
			.on(table.updatedAt)
			.where(sql`${table.completedAt} is null`),
	]
);
