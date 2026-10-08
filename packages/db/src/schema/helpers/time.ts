import { timestamp } from "drizzle-orm/pg-core";

export const timeFields = {
	createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
};
