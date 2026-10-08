import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";
import { users } from "./users.ts";

export const sessions = pgTable(
	"sessions",
	{
		activeOrganizationId: text("active_organization_id"),
		expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
		id: text("id").primaryKey(),
		ipAddress: text("ip_address"),
		token: text("token").notNull().unique(),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		...timeFields,
	},
	(table) => [index("session_user_id_idx").on(table.userId), index("session_token_idx").on(table.token)]
);

export type Session = typeof sessions.$inferSelect;

export type NewSession = typeof sessions.$inferInsert;
