import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "../auth/users.ts";

export const termsAcceptances = pgTable(
	"terms_acceptances",
	{
		acceptedAt: timestamp("accepted_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		version: text("version").notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.version] })]
);
