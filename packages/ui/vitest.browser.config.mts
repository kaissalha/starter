import react from "@vitejs/plugin-react";
/// <reference types="vitest" />
import { playwright } from "@vitest/browser-playwright";
import path from "node:path";
import { defineProject } from "vitest/config";

// oxlint-disable-next-line import/no-default-export
export default defineProject({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		browser: {
			enabled: true,
			headless: true,
			instances: [{ browser: "chromium" }],
			provider: playwright(),
		},
		include: ["**/*.browser.test.{ts,tsx}"],
		name: "ui-browser",
	},
});
