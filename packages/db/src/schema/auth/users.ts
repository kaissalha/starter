import { boolean, pgTable, text } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";

export const users = pgTable("users", {
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	id: text("id").primaryKey(),
	image: text("image"),
	name: text("name").notNull(),
	twoFactorEnabled: boolean("two_factor_enabled").default(false),
	...timeFields,
});

export type User = typeof users.$inferSelect;

export type NewUser = typeof users.$inferInsert;
