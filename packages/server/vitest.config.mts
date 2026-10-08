/// <reference types="vitest" />
import path from "node:path";
import { defineProject } from "vitest/config";

export default defineProject({
	oxc: { jsx: { runtime: "automatic" } },
	plugins: [],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		environment: "node",
		exclude: [
			"**/*.integration.test.{ts,tsx}",
			"**/*.workflow.test.ts",
			"tests/lib/auth.test.ts",
			"tests/services/websites.test.ts",
		],
		globals: true,
		include: ["tests/**/*.test.{ts,tsx}"],
		setupFiles: ["./tests/setup.ts"],
		testTimeout: process.env.CI === "true" ? 30_000 : 5000,
	},
});
