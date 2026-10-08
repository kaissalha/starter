import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import type { BrandFoundationV1 } from "@starter/infinite-brand";
import type { LinkPageDocument } from "@starter/infinite-links/contracts";

import { organizations } from "../auth/organizations.ts";
import { timeFields } from "../helpers/time.ts";

export const linkPages = pgTable(
	"link_pages",
	{
		document: jsonb("document").notNull().$type<LinkPageDocument>(),
		id: uuid("id").primaryKey().defaultRandom().notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		publishedAt: timestamp("published_at", { mode: "string", withTimezone: true }),
		publishedBrand: jsonb("published_brand").$type<BrandFoundationV1>(),
		publishedDocument: jsonb("published_document").$type<LinkPageDocument>(),
		...timeFields,
	},
	(table) => [uniqueIndex("link_pages_organization_id_unique").on(table.organizationId)]
);

export type LinkPageRecord = typeof linkPages.$inferSelect;

export type NewLinkPageRecord = typeof linkPages.$inferInsert;
