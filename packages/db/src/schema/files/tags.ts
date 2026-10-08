import { index, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { timeFields } from "../helpers/time.ts";
import { files } from "./files.ts";

export const fileTags = pgTable(
	"file_tags",
	{
		id: uuid("id").primaryKey().defaultRandom().notNull(),
		name: text("name").notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		slug: text("slug").notNull(),
		...timeFields,
	},
	(table) => [
		index("file_tags_organization_id_idx").on(table.organizationId),
		unique("file_tags_org_slug_idx").on(table.organizationId, table.slug),
	]
);

export const fileTagAssignments = pgTable(
	"file_tag_assignments",
	{
		fileId: uuid("file_id")
			.notNull()
			.references(() => files.id, { onDelete: "cascade" }),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		tagId: uuid("tag_id")
			.notNull()
			.references(() => fileTags.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.fileId, table.tagId] }),
		index("file_tag_assignments_tag_id_idx").on(table.tagId),
		index("file_tag_assignments_organization_id_idx").on(table.organizationId),
	]
);

export type FileTag = typeof fileTags.$inferSelect;

export type NewFileTag = typeof fileTags.$inferInsert;

export type FileTagAssignment = typeof fileTagAssignments.$inferSelect;

export type NewFileTagAssignment = typeof fileTagAssignments.$inferInsert;
