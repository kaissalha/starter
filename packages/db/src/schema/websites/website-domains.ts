import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";
import { domainRegistrations } from "./domain-registrations.ts";
import { websites } from "./websites.ts";

export type WebsiteDomainRecord = { name: string; ready: boolean; type: string; value: string };

export const websiteDomainMethods = ["records", "nameservers"] as const;

export type WebsiteDomainMethod = (typeof websiteDomainMethods)[number];

export const websiteDomains = pgTable(
	"website_domains",
	{
		caaBlocked: boolean("caa_blocked").notNull().default(false),
		checkedAt: timestamp("checked_at", { mode: "string", withTimezone: true }),
		conflicts: jsonb("conflicts").$type<Array<WebsiteDomainRecord>>().notNull().default([]),
		connectedAt: timestamp("connected_at", { mode: "string", withTimezone: true }),
		dnsReady: boolean("dns_ready").notNull().default(false),
		hostname: text("hostname").notNull(),
		id: uuid("id").primaryKey().defaultRandom(),
		method: text("method").$type<WebsiteDomainMethod>().notNull().default("records"),
		ownershipVerified: boolean("ownership_verified").notNull().default(false),
		primary: boolean("primary").notNull().default(false),
		records: jsonb("records").$type<Array<WebsiteDomainRecord>>().notNull().default([]),
		registrationId: uuid("registration_id").references(() => domainRegistrations.id, { onDelete: "set null" }),
		status: text("status").$type<"pending" | "connected" | "disconnecting">().notNull().default("pending"),
		tlsReady: boolean("tls_ready").notNull().default(false),
		verificationToken: uuid("verification_token").notNull().defaultRandom(),
		websiteId: uuid("website_id")
			.notNull()
			.references(() => websites.id, { onDelete: "cascade" }),
		...timeFields,
	},
	(table) => [
		uniqueIndex("website_domains_primary_unique")
			.on(table.websiteId)
			.where(sql`${table.primary} = true`),
		uniqueIndex("website_domains_verified_hostname_unique")
			.on(table.hostname)
			.where(sql`${table.ownershipVerified} = true`),
		uniqueIndex("website_domains_website_hostname_unique").on(table.websiteId, table.hostname),
		index("website_domains_hostname_idx").on(table.hostname),
		index("website_domains_pending_idx")
			.on(table.checkedAt)
			.where(sql`${table.status} <> 'connected'`),
		index("website_domains_website_idx").on(table.websiteId),
		index("website_domains_registration_idx").on(table.registrationId),
	]
);

export type WebsiteDomainRow = typeof websiteDomains.$inferSelect;
