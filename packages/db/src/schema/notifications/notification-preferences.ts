import { boolean, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { users } from "../auth/users.ts";

export const notificationChannels = ["in_app", "email"] as const;

export type NotificationChannel = (typeof notificationChannels)[number];

export const notificationPreferences = pgTable(
	"notification_preferences",
	{
		channel: text("channel").$type<NotificationChannel>().notNull(),
		enabled: boolean("enabled").notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.organizationId, table.userId, table.type, table.channel] })]
);
