/// <reference types="vitest" />
import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		environment: "node",
		globals: true,
		include: ["tests/**/*.test.ts"],
		testTimeout: process.env.CI === "true" ? 30_000 : 5000,
	},
});
