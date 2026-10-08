import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { Pool } from "pg";

import { relations } from "./relations.ts";
import { schema } from "./schema.ts";

const configuredDatabaseUrl =
	process.env.DATABASE_URL ??
	(process.env.NODE_ENV === "test" ? "postgres://test:test@localhost:5432/test" : undefined);

if (!configuredDatabaseUrl) {
	throw new Error("DATABASE_URL is required.");
}

export const databaseUrl = configuredDatabaseUrl;

export const pool = new Pool({
	connectionString: databaseUrl,
	connectionTimeoutMillis: 15_000,
	idleTimeoutMillis: 15_000,
	keepAlive: true,
	keepAliveInitialDelayMillis: 10_000,
	max: process.env.NODE_ENV === "production" ? 50 : 20,
	maxUses: 7500,
	min: 0,
});

if (process.env.NODE_ENV !== "test") {
	attachDatabasePool(pool);
}

pool.on("error", (error) =>
	console.error(
		JSON.stringify({
			errorMessage: error.message,
			errorName: error.name,
			level: "error",
			message: "[db] postgres pool idle error",
		})
	)
);

if (process.env.NODE_ENV === "production") {
	const eventLoop = monitorEventLoopDelay({ resolution: 20 });
	eventLoop.enable();
	setInterval(() => {
		if (pool.waitingCount > 0) {
			console.warn(
				JSON.stringify({
					eventLoopP99Ms: Math.round(eventLoop.percentile(99) / 1e6),
					idleCount: pool.idleCount,
					level: "warn",
					message: "[db] postgres pool saturated",
					totalCount: pool.totalCount,
					waitingCount: pool.waitingCount,
				})
			);
		}

		eventLoop.reset();
	}, 1000).unref();
}

export const db = drizzle({
	client: pool,
	logger: false,
	relations,
});

export { schema };

export * from "./relations.ts";

export * from "./schema/auth/accounts.ts";

export * from "./schema/auth/api-keys.ts";

export * from "./schema/auth/invitations.ts";

export * from "./schema/auth/jwks.ts";

export * from "./schema/auth/members.ts";

export * from "./schema/auth/oauth.ts";

export * from "./schema/auth/organizations.ts";

export * from "./schema/auth/sessions.ts";

export * from "./schema/auth/users.ts";

export * from "./schema/auth/verifications.ts";

export * from "./schema/events/event-dispatches.ts";

export * from "./schema/events/event-executions.ts";

export * from "./schema/events/events.ts";

export * from "./schema/files/files.ts";

export * from "./schema/files/tags.ts";

export * from "./schema/notifications/notification-email-deliveries.ts";

export * from "./schema/notifications/notification-inboxes.ts";

export * from "./schema/notifications/notification-preferences.ts";

export * from "./schema/notifications/notifications.ts";

export * from "./schema/organizations/organization-purges.ts";

export * from "./utils/filtering.ts";

export * from "./utils/pagination.ts";

export * from "./utils/search.ts";

export * from "./utils/sorting.ts";

export const isUniqueViolation = ({ error }: { error: Error }) =>
	error.cause instanceof Error && "code" in error.cause && error.cause.code === "23505";

export type Transaction = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

export type Database = typeof db;
