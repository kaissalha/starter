import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";

export const organizationPurges = pgTable(
	"organization_purges",
	{
		attempts: integer("attempts").notNull().default(0),
		blobs: jsonb("blobs").$type<Array<{ access: "private" | "public"; url: string }>>().notNull().default([]),
		completedAt: timestamp("completed_at", { mode: "string", withTimezone: true }),
		hostnames: jsonb("hostnames").$type<Array<{ hostname: string; websiteId: string }>>().notNull().default([]),
		lastError: text("last_error"),
		organizationId: text("organization_id").primaryKey(),
		registrationDomains: jsonb("registration_domains").$type<Array<string>>().notNull().default([]),
		...timeFields,
	},
	(table) => [
		index("organization_purges_pending_idx")
			.on(table.updatedAt)
			.where(sql`${table.completedAt} is null`),
	]
);
