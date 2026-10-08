import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { sessions } from "./sessions.ts";
import { users } from "./users.ts";

type OAuthMetadataValue = boolean | null | number | string | Array<string>;

export const oauthClients = pgTable(
	"oauth_clients",
	{
		applicationType: text("application_type"),
		backchannelLogoutSessionRequired: boolean("backchannel_logout_session_required"),
		backchannelLogoutUri: text("backchannel_logout_uri"),
		clientCredentialsScopes: text("client_credentials_scopes").array().default([]),
		clientDiscoveryId: text("client_discovery_id"),
		clientId: text("client_id").notNull().unique(),
		clientSecret: text("client_secret"),
		contacts: text("contacts").array(),
		createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		disabled: boolean("disabled").default(false),
		dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
		enableEndSession: boolean("enable_end_session"),
		grantTypes: text("grant_types").array(),
		icon: text("icon"),
		id: text("id").primaryKey(),
		jwks: text("jwks"),
		jwksUri: text("jwks_uri"),
		metadata: jsonb("metadata").$type<Record<string, OAuthMetadataValue>>(),
		name: text("name"),
		policy: text("policy"),
		postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
		redirectUris: text("redirect_uris").array().notNull(),
		referenceId: text("reference_id"),
		requirePKCE: boolean("require_pkce"),
		responseTypes: text("response_types").array(),
		scopes: text("scopes").array(),
		skipConsent: boolean("skip_consent"),
		softwareId: text("software_id"),
		softwareStatement: text("software_statement"),
		softwareVersion: text("software_version"),
		subjectType: text("subject_type"),
		tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
		tos: text("tos"),
		updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		uri: text("uri"),
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("oauth_client_user_id_idx").on(table.userId),
		index("oauth_client_reference_id_idx").on(table.referenceId),
	]
);

export const oauthResources = pgTable("oauth_resources", {
	accessTokenTtl: integer("access_token_ttl"),
	allowedScopes: text("allowed_scopes").array(),
	createdAt: timestamp("created_at", { mode: "string", withTimezone: true }),
	customClaims: jsonb("custom_claims"),
	disabled: boolean("disabled").default(false),
	dpopBoundAccessTokensRequired: boolean("dpop_bound_access_tokens_required").default(false),
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull().unique(),
	metadata: jsonb("metadata"),
	name: text("name").notNull(),
	policyVersion: integer("policy_version").default(1),
	refreshTokenTtl: integer("refresh_token_ttl"),
	signingAlgorithm: text("signing_algorithm"),
	signingKeyId: text("signing_key_id"),
	updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }),
});

export const oauthClientResources = pgTable(
	"oauth_client_resources",
	{
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClients.clientId, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { mode: "string", withTimezone: true }),
		id: text("id").primaryKey(),
		metadata: jsonb("metadata"),
		resourceId: text("resource_id")
			.notNull()
			.references(() => oauthResources.identifier, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("oauth_client_resource_client_id_resource_id_uidx").on(table.clientId, table.resourceId),
		index("oauth_client_resource_client_id_idx").on(table.clientId),
		index("oauth_client_resource_resource_id_idx").on(table.resourceId),
	]
);

export const oauthRefreshTokens = pgTable(
	"oauth_refresh_tokens",
	{
		authorizationCodeId: text("authorization_code_id"),
		authTime: timestamp("auth_time", { mode: "string", withTimezone: true }),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClients.clientId, { onDelete: "cascade" }),
		confirmation: jsonb("confirmation"),
		createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
		id: text("id").primaryKey(),
		referenceId: text("reference_id"),
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		resources: text("resources").array(),
		revoked: timestamp("revoked", { mode: "string", withTimezone: true }),
		rotatedAt: timestamp("rotated_at", { mode: "string", withTimezone: true }),
		rotationReplayExpiresAt: timestamp("rotation_replay_expires_at", { mode: "string", withTimezone: true }),
		rotationReplayResponse: text("rotation_replay_response"),
		scopes: text("scopes").array().notNull(),
		sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
		token: text("token").notNull().unique(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("oauth_refresh_token_client_id_idx").on(table.clientId),
		index("oauth_refresh_token_session_id_idx").on(table.sessionId),
		index("oauth_refresh_token_user_id_idx").on(table.userId),
		index("oauth_refresh_token_reference_id_idx").on(table.referenceId),
		index("oauth_refresh_token_authorization_code_id_idx").on(table.authorizationCodeId),
	]
);

export const oauthAccessTokens = pgTable(
	"oauth_access_tokens",
	{
		authorizationCodeId: text("authorization_code_id"),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClients.clientId, { onDelete: "cascade" }),
		confirmation: jsonb("confirmation"),
		createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
		id: text("id").primaryKey(),
		referenceId: text("reference_id"),
		refreshId: text("refresh_id").references(() => oauthRefreshTokens.id, { onDelete: "cascade" }),
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		resources: text("resources").array(),
		revoked: timestamp("revoked", { mode: "string", withTimezone: true }),
		scopes: text("scopes").array().notNull(),
		sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
		token: text("token").notNull().unique(),
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("oauth_access_token_client_id_idx").on(table.clientId),
		index("oauth_access_token_session_id_idx").on(table.sessionId),
		index("oauth_access_token_user_id_idx").on(table.userId),
		index("oauth_access_token_refresh_id_idx").on(table.refreshId),
		index("oauth_access_token_reference_id_idx").on(table.referenceId),
		index("oauth_access_token_authorization_code_id_idx").on(table.authorizationCodeId),
	]
);

export const oauthConsents = pgTable(
	"oauth_consents",
	{
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClients.clientId, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		id: text("id").primaryKey(),
		referenceId: text("reference_id"),
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		resources: text("resources").array(),
		scopes: text("scopes").array().notNull(),
		updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("oauth_consent_client_id_idx").on(table.clientId),
		index("oauth_consent_user_id_idx").on(table.userId),
		index("oauth_consent_reference_id_idx").on(table.referenceId),
	]
);

export const oauthClientAssertions = pgTable("oauth_client_assertions", {
	expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
	id: text("id").primaryKey(),
});

export type OAuthClient = typeof oauthClients.$inferSelect;

export type NewOAuthClient = typeof oauthClients.$inferInsert;

export type OAuthResource = typeof oauthResources.$inferSelect;

export type NewOAuthResource = typeof oauthResources.$inferInsert;

export type OAuthClientResource = typeof oauthClientResources.$inferSelect;

export type NewOAuthClientResource = typeof oauthClientResources.$inferInsert;

export type OAuthRefreshToken = typeof oauthRefreshTokens.$inferSelect;

export type NewOAuthRefreshToken = typeof oauthRefreshTokens.$inferInsert;

export type OAuthAccessToken = typeof oauthAccessTokens.$inferSelect;

export type NewOAuthAccessToken = typeof oauthAccessTokens.$inferInsert;

export type OAuthConsent = typeof oauthConsents.$inferSelect;

export type NewOAuthConsent = typeof oauthConsents.$inferInsert;

export type OAuthClientAssertion = typeof oauthClientAssertions.$inferSelect;

export type NewOAuthClientAssertion = typeof oauthClientAssertions.$inferInsert;
