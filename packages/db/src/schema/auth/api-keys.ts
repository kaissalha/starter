import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { timeFields } from "../helpers/time.ts";

export const apikeys = pgTable(
	"apikeys",
	{
		configId: text("config_id").notNull().default("default"),
		enabled: boolean("enabled").default(true),
		expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }),
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		lastRefillAt: timestamp("last_refill_at", { mode: "string", withTimezone: true }),
		lastRequest: timestamp("last_request", { mode: "string", withTimezone: true }),
		metadata: text("metadata"),
		name: text("name"),
		permissions: text("permissions"),
		prefix: text("prefix"),
		rateLimitEnabled: boolean("rate_limit_enabled").default(true),
		rateLimitMax: integer("rate_limit_max").default(10),
		rateLimitTimeWindow: integer("rate_limit_time_window").default(86_400_000),
		referenceId: text("reference_id").notNull(),
		refillAmount: integer("refill_amount"),
		refillInterval: integer("refill_interval"),
		remaining: integer("remaining"),
		requestCount: integer("request_count").default(0),
		start: text("start"),
		...timeFields,
	},
	(table) => [
		index("apikey_config_id_idx").on(table.configId),
		index("apikey_key_idx").on(table.key),
		index("apikey_reference_id_idx").on(table.referenceId),
	]
);

export type ApiKey = typeof apikeys.$inferSelect;

export type NewApiKey = typeof apikeys.$inferInsert;
