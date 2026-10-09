/// <reference types="vitest" />
import path from "node:path";
import { defineProject } from "vitest/config";

// oxlint-disable-next-line import/no-default-export
export default defineProject({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		environment: "node",
		fileParallelism: false,
		globals: true,
		globalSetup: "../../tools/testing/redis-global-setup.ts",
		include: ["**/*.integration.test.{ts,tsx}"],
		name: "cache-integration",
	},
});
