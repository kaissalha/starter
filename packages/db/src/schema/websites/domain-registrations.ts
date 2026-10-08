import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { timeFields } from "../helpers/time.ts";
import { websites } from "./websites.ts";

export type DomainRegistrant = {
	additional?: Record<string, string>;
	address1: string;
	address2?: string;
	city: string;
	companyName?: string;
	country: string;
	email: string;
	firstName: string;
	lastName: string;
	phone: string;
	state: string;
	zip: string;
};

export const domainRegistrationStatuses = ["registering", "active", "failed", "expired"] as const;

export type DomainRegistrationStatus = (typeof domainRegistrationStatuses)[number];

export const domainRegistrations = pgTable(
	"domain_registrations",
	{
		autoRenew: boolean("auto_renew").notNull().default(true),
		domain: text("domain").notNull().unique(),
		expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }),
		failureCode: text("failure_code"),
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: text("order_id"),
		organizationId: text("organization_id").references(() => organizations.id, { onDelete: "set null" }),
		provider: text("provider").$type<"vercel">().notNull().default("vercel"),
		purchasePrice: numeric("purchase_price", { mode: "number" }).notNull(),
		registeredAt: timestamp("registered_at", { mode: "string", withTimezone: true }),
		registrant: jsonb("registrant").$type<DomainRegistrant>().notNull(),
		reminderDays: integer("reminder_days"),
		renewalPrice: numeric("renewal_price", { mode: "number" }).notNull(),
		status: text("status").$type<DomainRegistrationStatus>().notNull().default("registering"),
		websiteId: uuid("website_id").references(() => websites.id, { onDelete: "set null" }),
		workflowRunId: text("workflow_run_id"),
		years: integer("years").notNull().default(1),
		...timeFields,
	},
	(table) => [
		index("domain_registrations_organization_idx").on(table.organizationId),
		index("domain_registrations_website_idx").on(table.websiteId),
	]
);

export type DomainRegistrationRow = typeof domainRegistrations.$inferSelect;
