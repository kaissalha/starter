import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, testUtils } from "better-auth/plugins";

import { db, schema } from "@starter/db";

export const testAuth = betterAuth({
	baseURL: "http://localhost:3000",
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
		usePlural: true,
	}),
	plugins: [organization(), testUtils()],
});

export const authTestHelpers = (await testAuth.$context).test;
