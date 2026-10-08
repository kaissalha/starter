import react from "@vitejs/plugin-react";
/// <reference types="vitest" />
import path from "node:path";
import { defineProject } from "vitest/config";

export default defineProject({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		environment: "happy-dom",
		exclude: ["**/*.browser.test.{ts,tsx}"],
		globals: true,
		include: ["tests/**/*.test.{ts,tsx}"],
		setupFiles: ["./tests/setup.ts"],
	},
});
