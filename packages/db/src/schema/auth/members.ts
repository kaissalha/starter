import { index, pgTable, text } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";
import { organizations } from "./organizations.ts";
import { users } from "./users.ts";

export const members = pgTable(
	"members",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		role: text("role").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		...timeFields,
	},
	(table) => [
		index("member_user_id_idx").on(table.userId),
		index("member_organization_id_idx").on(table.organizationId),
	]
);

export type Member = typeof members.$inferSelect;

export type NewMember = typeof members.$inferInsert;
