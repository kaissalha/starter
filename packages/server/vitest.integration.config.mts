/// <reference types="vitest" />
import path from "node:path";
import { defineProject } from "vitest/config";

// oxlint-disable-next-line import/no-default-export
export default defineProject({
	oxc: { jsx: { runtime: "automatic" } },
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	root: import.meta.dirname,
	test: {
		environment: "node",
		fileParallelism: false,
		globals: true,
		globalSetup: path.resolve(import.meta.dirname, "../../globalSetup.ts"),
		include: ["**/*.integration.test.{ts,tsx}", "tests/lib/auth.test.ts", "tests/services/websites.test.ts"],
		name: "server-integration",
		setupFiles: [path.resolve(import.meta.dirname, "./tests/setup.ts")],
	},
});
