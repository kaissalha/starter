import { foreignKey, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import type { Iso6391LanguageCode, WebsiteBriefV1 } from "@starter/infinite-website/contracts";

import { organizations } from "../auth/organizations.ts";
import { timeFields } from "../helpers/time.ts";
import { websiteVersions } from "./website-versions.ts";

export const websites = pgTable(
	"websites",
	{
		brief: jsonb("brief").notNull().$type<WebsiteBriefV1>(),
		draftVersionId: uuid("draft_version_id"),
		id: uuid("id").primaryKey().defaultRandom().notNull(),
		locale: text("locale").notNull().$type<Iso6391LanguageCode>(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		publishedVersionId: uuid("published_version_id"),
		subdomain: text("subdomain").unique(),
		suspendedAt: timestamp("suspended_at", { mode: "string", withTimezone: true }),
		suspensionReason: text("suspension_reason"),
		translationLocale: text("translation_locale").$type<Iso6391LanguageCode>(),
		workflowRunId: text("workflow_run_id"),
		...timeFields,
	},
	(table) => [
		uniqueIndex("websites_organization_id_unique").on(table.organizationId),
		foreignKey({
			columns: [table.id, table.draftVersionId],
			foreignColumns: [websiteVersions.websiteId, websiteVersions.id],
			name: "websites_draft_version_owner_fkey",
		}),
		foreignKey({
			columns: [table.id, table.publishedVersionId],
			foreignColumns: [websiteVersions.websiteId, websiteVersions.id],
			name: "websites_published_version_owner_fkey",
		}),
	]
);

export type WebsiteRecord = typeof websites.$inferSelect;

export type NewWebsiteRecord = typeof websites.$inferInsert;

export const websiteSubdomainHistory = pgTable("website_subdomain_history", {
	releasedAt: timestamp("released_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
	subdomain: text("subdomain").primaryKey(),
	websiteId: uuid("website_id").references(() => websites.id, { onDelete: "set null" }),
});
