/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
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
		environment: "node",
		globals: true,
		include: ["**/*.test.{ts,tsx}"],
	},
});
