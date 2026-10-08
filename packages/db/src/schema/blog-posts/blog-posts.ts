import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import type { BlogPostDocument } from "@starter/infinite-website/contracts";

import { organizations } from "../auth/organizations.ts";
import { timeFields } from "../helpers/time.ts";

export const blogPosts = pgTable(
	"blog_posts",
	{
		document: jsonb("document").notNull().$type<BlogPostDocument>(),
		firstPublishedAt: timestamp("first_published_at", { mode: "string", withTimezone: true }),
		generationError: text("generation_error"),
		generationRunId: text("generation_run_id"),
		generationStatus: text("generation_status", { enum: ["idle", "writing", "failed"] })
			.notNull()
			.default("idle"),
		generationToken: uuid("generation_token"),
		id: uuid("id").primaryKey().defaultRandom().notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		publishedAt: timestamp("published_at", { mode: "string", withTimezone: true }),
		publishedDocument: jsonb("published_document").$type<BlogPostDocument>(),
		publishedRevision: integer("published_revision"),
		publishedUpdatedAt: timestamp("published_updated_at", { mode: "string", withTimezone: true }),
		revision: integer("revision").notNull().default(1),
		slug: text("slug").notNull(),
		...timeFields,
	},
	(table) => [
		uniqueIndex("blog_posts_organization_slug_unique").on(table.organizationId, table.slug),
		index("blog_posts_organization_published_idx").on(table.organizationId, table.publishedAt),
	]
);

export type BlogPostRecord = typeof blogPosts.$inferSelect;

export type NewBlogPostRecord = typeof blogPosts.$inferInsert;
