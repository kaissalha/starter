/// <reference types="vitest" />
import path from "node:path";
import { defineProject } from "vitest/config";

export default defineProject({
	plugins: [],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		environment: "node",
		globals: true,
		include: ["**/*.test.{ts,tsx}"],
	},
});
