import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3100";

process.env.NODE_OPTIONS =
	`${process.env.NODE_OPTIONS ?? ""} --import ${new URL("./e2e/json-import-attributes.mjs", import.meta.url).href}`.trim();

// oxlint-disable-next-line import/no-default-export -- Playwright loads this configuration through its default export.
export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	fullyParallel: false,
	globalSetup: "./e2e/global-setup.ts",
	projects: [
		{
			name: "setup",
			testMatch: /.*\.setup\.ts/u,
		},
		{
			dependencies: ["setup"],
			name: "chromium",
			testIgnore: [/.*\.setup\.ts/u, /mobile\//u],
			use: {
				...devices["Desktop Chrome"],
				storageState: "e2e/.auth/user.json",
			},
		},
		{
			dependencies: ["setup"],
			name: "mobile",
			testMatch: /mobile\/.*\.spec\.ts/u,
			use: {
				...devices["iPhone 13"],
				browserName: "chromium",
				storageState: "e2e/.auth/user.json",
			},
		},
	],
	reporter: process.env.CI ? "github" : "list",
	retries: process.env.CI ? 2 : 0,
	testDir: "./e2e",
	timeout: 60_000,
	use: {
		baseURL,
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
		video: "retain-on-failure",
	},
	workers: 1,
});
