import { type SQL, sql } from "drizzle-orm";
import { check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { timeFields } from "../helpers/time.ts";
import { tsvector } from "../helpers/tsvector.ts";

export const contacts = pgTable(
	"contacts",
	{
		email: text("email"),
		id: uuid("id").defaultRandom().primaryKey(),
		name: text("name"),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		phone: text("phone"),
		...timeFields,
		fts: tsvector("fts")
			.notNull()
			.generatedAlwaysAs(
				(): SQL =>
					sql`to_tsvector('english'::regconfig, COALESCE(${contacts.name}, '') || ' ' || COALESCE(translate(${contacts.email}, '@.', '  '), '') || ' ' || COALESCE(translate(${contacts.phone}, '+-().', '     '), ''))`
			),
	},
	(table) => [
		uniqueIndex("contacts_org_email_unique").on(table.organizationId, sql`lower(btrim(${table.email}))`),
		index("contacts_org_created_idx").on(table.organizationId, table.createdAt, table.id),
		index("contacts_fts_idx").using("gin", table.fts.asc().nullsLast().op("tsvector_ops")),
		check(
			"contacts_identity_required",
			sql`coalesce(nullif(btrim(${table.name}), ''), nullif(btrim(${table.email}), ''), nullif(btrim(${table.phone}), '')) is not null`
		),
	]
);
