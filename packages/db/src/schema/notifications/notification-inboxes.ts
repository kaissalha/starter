import { bigint, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { users } from "../auth/users.ts";

export const notificationInboxes = pgTable(
	"notification_inboxes",
	{
		lastSequence: bigint("last_sequence", { mode: "number" }).default(0).notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.organizationId, table.userId] })]
);
