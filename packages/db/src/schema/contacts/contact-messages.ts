import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { websites } from "../websites/websites";
import { contacts } from "./contacts";

export const contactMessageTriageCategories = ["sales", "support", "booking", "feedback", "other", "unknown"] as const;

export const contactMessageTriageUrgencies = ["routine", "timeSensitive", "unknown"] as const;

export type ContactMessageTriageCategory = (typeof contactMessageTriageCategories)[number];

export type ContactMessageTriageUrgency = (typeof contactMessageTriageUrgencies)[number];

export const contactMessages = pgTable(
	"contact_messages",
	{
		contactId: uuid("contact_id")
			.notNull()
			.references(() => contacts.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		id: uuid("id").defaultRandom().primaryKey(),
		message: text("message").notNull(),
		sectionId: uuid("section_id").notNull(),
		senderName: text("sender_name").notNull(),
		senderPhone: text("sender_phone"),
		spamFlag: boolean("spam_flag").default(false).notNull(),
		triageCategory: text("triage_category").$type<ContactMessageTriageCategory>(),
		triagedAt: timestamp("triaged_at", { mode: "string", withTimezone: true }),
		triageUrgency: text("triage_urgency").$type<ContactMessageTriageUrgency>(),
		websiteId: uuid("website_id").references(() => websites.id, { onDelete: "set null" }),
	},
	(table) => [
		index("contact_messages_contact_created_idx").on(table.contactId, table.createdAt, table.id),
		index("contact_messages_website_idx").on(table.websiteId),
	]
);
