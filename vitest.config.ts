import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		coverage: {
			exclude: ["**/*.d.ts", "**/*.stories.{ts,tsx}", "**/.well-known/workflow/**", "**/db/migrations/**"],
			include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
			provider: "v8",
			reporter: ["text", "html", "json-summary", "lcov"],
			reportsDirectory: "./coverage",
		},
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/cypress/**",
			"**/.{idea,git,cache,output,temp}/**",
			"**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress}.config.*",
		],
		maxWorkers: process.env.CI === "true" ? 2 : undefined,
		projects: [
			"apps/*",
			"packages/*",
			"packages/cache/vitest.integration.config.mts",
			"packages/server/vitest.integration.config.mts",
			"packages/ui/vitest.browser.config.mts",
			"tools/oxlint/anti-slop/vitest.config.ts",
		],
		reporters: ["default"],
	},
});
