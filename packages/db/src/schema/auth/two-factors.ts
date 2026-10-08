import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./users.ts";

export const twoFactors = pgTable(
	"two_factors",
	{
		backupCodes: text("backup_codes").notNull(),
		failedVerificationCount: integer("failed_verification_count").default(0),
		id: text("id").primaryKey(),
		lockedUntil: timestamp("locked_until", { mode: "string", withTimezone: true }),
		secret: text("secret").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		verified: boolean("verified").default(true),
	},
	(table) => [index("two_factors_secret_idx").on(table.secret), index("two_factors_user_id_idx").on(table.userId)]
);

export type TwoFactor = typeof twoFactors.$inferSelect;

export type NewTwoFactor = typeof twoFactors.$inferInsert;
