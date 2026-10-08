import { index, pgTable, text } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";

export const organizations = pgTable(
	"organizations",
	{
		id: text("id").primaryKey(),
		logo: text("logo"),
		metadata: text("metadata"),
		name: text("name").notNull(),
		slug: text("slug"),
		...timeFields,
	},
	(table) => [index("organization_slug_idx").on(table.slug)]
);

export type Organization = typeof organizations.$inferSelect;

export type NewOrganization = typeof organizations.$inferInsert;
