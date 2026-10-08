import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../auth/organizations.ts";
import { users } from "../auth/users.ts";
import { timeFields } from "../helpers/time.ts";

export const oauthProviderEnum = pgEnum("oauth_provider", ["gmail", "google_calendar"]);

export const oauthProviderEnumValues = oauthProviderEnum.enumValues;

export const oauthConnectionStatusEnum = pgEnum("oauth_connection_status", [
	"connected",
	"disconnected",
	"error",
	"expired",
]);

export const oauthConnections = pgTable(
	"oauth_connections",
	{
		accessToken: text("access_token").notNull(),

		email: text("email").notNull(),
		expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),

		externalId: text("external_id").notNull(),
		id: uuid("id").defaultRandom().primaryKey().notNull(),

		lastAccessedAt: timestamp("last_accessed_at", { mode: "string", withTimezone: true }),
		name: text("name"),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		picture: text("picture"),
		provider: oauthProviderEnum("provider").notNull(),
		refreshToken: text("refresh_token").notNull(),
		scopes: text("scopes").array(),

		status: oauthConnectionStatusEnum("status").default("connected").notNull(),

		syncedAt: timestamp("synced_at", { mode: "string", withTimezone: true }),
		syncToken: text("sync_token"),

		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
		watchExpiration: timestamp("watch_expiration", { mode: "string", withTimezone: true }),
		watchId: text("watch_id"),

		watchResourceId: text("watch_resource_id"),

		...timeFields,
	},
	(table) => [
		uniqueIndex("oauth_connection_org_level_unique")
			.on(table.externalId, table.provider, table.organizationId)
			.where(sql`${table.userId} IS NULL`),

		uniqueIndex("oauth_connection_user_level_unique")
			.on(table.externalId, table.provider, table.organizationId, table.userId)
			.where(sql`${table.userId} IS NOT NULL`),

		index("oauth_connection_user_id_idx").on(table.userId),
		index("oauth_connection_org_id_idx").on(table.organizationId),

		index("oauth_connection_watch_expiration_idx").on(table.watchExpiration),
	]
);

export type OAuthConnection = typeof oauthConnections.$inferSelect;

export type NewOAuthConnection = typeof oauthConnections.$inferInsert;

export type OAuthProvider = (typeof oauthProviderEnum.enumValues)[number];

export type OAuthConnectionStatus = (typeof oauthConnectionStatusEnum.enumValues)[number];
