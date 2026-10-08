import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

import type {
	PersistedWebsiteContentV1,
	PersistedWebsiteSiteV1,
	PersistedWebsiteStructureV1,
} from "@starter/infinite-website/contracts";

import { timeFields } from "../helpers/time.ts";
import { websites } from "./websites.ts";

export const websiteVersions = pgTable(
	"website_versions",
	{
		assetBindings: jsonb("asset_bindings").notNull().$type<PersistedWebsiteSiteV1["assetBindings"]>(),
		brand: jsonb("brand").notNull().$type<PersistedWebsiteSiteV1["brand"]>(),
		content: jsonb("content").notNull().$type<PersistedWebsiteContentV1>(),
		id: uuid("id").primaryKey().defaultRandom().notNull(),
		logic: jsonb("logic").notNull().default({}).$type<NonNullable<PersistedWebsiteSiteV1["document"]["logic"]>>(),
		publishedAt: timestamp("published_at", { mode: "string", withTimezone: true }),

		structure: jsonb("structure").notNull().$type<PersistedWebsiteStructureV1>(),
		templateId: text("template_id").notNull(),
		version: integer("version").notNull(),
		websiteId: uuid("website_id")
			.notNull()
			.references((): AnyPgColumn => websites.id, { onDelete: "cascade" }),
		...timeFields,
	},
	(table) => [
		uniqueIndex("website_versions_website_id_id_unique").on(table.websiteId, table.id),
		uniqueIndex("website_versions_website_id_version_unique").on(table.websiteId, table.version),
	]
);

export type WebsiteVersionRecord = typeof websiteVersions.$inferSelect;

export type NewWebsiteVersionRecord = typeof websiteVersions.$inferInsert;
