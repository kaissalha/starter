/// <reference types="vitest" />
import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		environment: "node",
		exclude: ["**/*.integration.test.{ts,tsx}"],
		globals: true,
		include: ["tests/**/*.test.{ts,tsx}"],
	},
});
