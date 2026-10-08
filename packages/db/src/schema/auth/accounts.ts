import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";
import { users } from "./users.ts";

export const accounts = pgTable(
	"accounts",
	{
		accessToken: text("access_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "string", withTimezone: true }),
		accountId: text("account_id").notNull(),
		id: text("id").primaryKey(),
		idToken: text("id_token"),
		issuer: text("issuer"),
		password: text("password"),
		providerId: text("provider_id").notNull(),
		refreshToken: text("refresh_token"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "string", withTimezone: true }),
		scope: text("scope"),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		...timeFields,
	},
	(table) => [index("account_user_id_idx").on(table.userId)]
);

export type Account = typeof accounts.$inferSelect;

export type NewAccount = typeof accounts.$inferInsert;
