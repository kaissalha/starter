import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
	throw new Error("DATABASE_URL is not defined in environment variables");
}

export default defineConfig({
	dbCredentials: {
		url,
	},
	dialect: "postgresql",
	out: "./src/db/migrations",
	schema: "./src/schema/**/*.ts",
});
