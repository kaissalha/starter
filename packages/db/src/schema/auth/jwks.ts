import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const jwks = pgTable("jwks", {
	alg: text("alg"),
	createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).defaultNow().notNull(),
	crv: text("crv"),
	expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }),
	id: text("id").primaryKey(),
	privateKey: text("private_key").notNull(),
	publicKey: text("public_key").notNull(),
});

export type Jwk = typeof jwks.$inferSelect;

export type NewJwk = typeof jwks.$inferInsert;
