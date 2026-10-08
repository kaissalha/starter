import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { users } from "../auth/users.ts";
import { events } from "../events/events.ts";

export const notificationEmailDeliveries = pgTable(
	"notification_email_deliveries",
	{
		acceptedAt: timestamp("accepted_at", { mode: "string", withTimezone: true }),
		createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		providerMessageId: text("provider_message_id"),
		recipientUserId: text("recipient_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
	},
	(table) => [
		uniqueIndex("notification_email_deliveries_event_type_recipient_unique").on(
			table.eventId,
			table.type,
			table.recipientUserId
		),
		index("notification_email_deliveries_organization_idx").on(table.organizationId),
	]
);
