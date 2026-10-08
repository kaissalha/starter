import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";

export const verifications = pgTable(
	"verifications",
	{
		expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		...timeFields,
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)]
);

export type Verification = typeof verifications.$inferSelect;

export type NewVerification = typeof verifications.$inferInsert;
