import { workflow } from "@workflow/vitest";
import path from "node:path";
import { defineConfig } from "vitest/config";

const workflowTestsDirectory = path.join(import.meta.dirname, "tests/workflows/integration");

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
	oxc: { jsx: { runtime: "automatic" } },
	plugins: [
		workflow({
			cwd: workflowTestsDirectory,
			rootDir: workflowTestsDirectory,
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	root: workflowTestsDirectory,
	ssr: {
		noExternal: ["@starter/infinite-website"],
	},
	test: {
		env: { AI_GATEWAY_API_KEY: "test-gateway-key" },
		environment: "node",
		include: ["*.workflow.test.ts"],
		setupFiles: [new URL("../../e2e/json-import-attributes.mjs", import.meta.url).pathname],
		testTimeout: 60_000,
	},
});
