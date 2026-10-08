import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";
import { organizations } from "./organizations.ts";
import { users } from "./users.ts";

export const invitations = pgTable(
	"invitations",
	{
		email: text("email").notNull(),
		expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
		id: text("id").primaryKey(),
		inviterId: text("inviter_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		role: text("role"),
		status: text("status").notNull(),
		...timeFields,
	},
	(table) => [
		index("invitation_email_idx").on(table.email),
		index("invitation_organization_id_idx").on(table.organizationId),
	]
);

export type Invitation = typeof invitations.$inferSelect;

export type NewInvitation = typeof invitations.$inferInsert;
