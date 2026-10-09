import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const baseURL = "http://localhost:3100";

const storageState = fileURLToPath(new URL(".auth/user.json", import.meta.url));

process.env.NODE_OPTIONS =
	`${process.env.NODE_OPTIONS ?? ""} --import ${new URL("./json-import-attributes.mjs", import.meta.url).href}`.trim();

// oxlint-disable-next-line import/no-default-export -- Playwright loads this configuration through its default export.
export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	fullyParallel: false,
	globalSetup: "./global-setup.ts",
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
				storageState,
			},
		},
		{
			dependencies: ["setup"],
			name: "mobile",
			testMatch: /mobile\/.*\.spec\.ts/u,
			use: {
				...devices["iPhone 13"],
				browserName: "chromium",
				storageState,
			},
		},
	],
	reporter: process.env.CI ? "github" : "list",
	retries: process.env.CI ? 2 : 0,
	testDir: ".",
	timeout: 60_000,
	use: {
		baseURL,
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
		video: "retain-on-failure",
	},
	workers: 1,
});
