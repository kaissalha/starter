import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBaseURL } from "../src/url";

const originalWindow = globalThis.window;

const setWindow = (value: Window | { location: { origin?: string } }) => {
	Object.defineProperty(globalThis, "window", { configurable: true, value, writable: true });
};

const production = { NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: "master" };

const branchUrl = { NEXT_PUBLIC_VERCEL_BRANCH_URL: "branch-preview.vercel.app" };

const previewUrl = { NEXT_PUBLIC_VERCEL_URL: "preview.vercel.app" };

describe("getBaseURL", () => {
	beforeEach(() => {
		for (const key of [
			"NEXT_PUBLIC_BASE_URL",
			"NEXT_PUBLIC_VERCEL_BRANCH_URL",
			"NEXT_PUBLIC_VERCEL_ENV",
			"NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF",
			"NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
			"NEXT_PUBLIC_VERCEL_URL",
			"PORT",
		]) {
			vi.stubEnv(key, undefined);
		}
	});

	afterEach(() => {
		vi.unstubAllEnvs();

		if (originalWindow === undefined) {
			Reflect.deleteProperty(globalThis, "window");
		} else {
			setWindow(originalWindow);
		}
	});

	it.each([
		[
			"main branch uses the Vercel production domain",
			{ NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: "main", NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "example.com" },
			"https://example.com/",
		],
		[
			"Vercel production env without a commit ref",
			{ NEXT_PUBLIC_VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "example.com" },
			"https://example.com/",
		],
		[
			"NEXT_PUBLIC_BASE_URL wins and is reduced to its origin",
			{
				...production,
				NEXT_PUBLIC_BASE_URL: "https://app.example.com/dashboard?tab=1",
				NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "example.com",
			},
			"https://app.example.com/",
		],
		[
			"blank NEXT_PUBLIC_BASE_URL is unset",
			{ ...production, NEXT_PUBLIC_BASE_URL: "   ", NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "example.com" },
			"https://example.com/",
		],
		[
			"production ignores branch and preview URLs",
			{ ...production, NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "example.com", ...branchUrl, ...previewUrl },
			"https://example.com/",
		],
		[
			"preview ignores production settings",
			{
				NEXT_PUBLIC_BASE_URL: "https://app.example.com",
				NEXT_PUBLIC_VERCEL_ENV: "preview",
				NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: "feature-branch",
				...branchUrl,
			},
			"https://branch-preview.vercel.app/",
		],
		["branch URL beats preview URL", { ...branchUrl, ...previewUrl }, "https://branch-preview.vercel.app/"],
		["preview URL", previewUrl, "https://preview.vercel.app/"],
		[
			"blank env vars fall back to localhost",
			{ NEXT_PUBLIC_VERCEL_BRANCH_URL: "", NEXT_PUBLIC_VERCEL_URL: "" },
			"http://localhost:3000/",
		],
		["configured local port", { PORT: "3100" }, "http://localhost:3100/"],
	])("%s", (_name, env, expected) => {
		for (const [key, value] of Object.entries(env)) {
			vi.stubEnv(key, value);
		}

		expect(getBaseURL().toString()).toBe(expected);
	});

	it.each([
		[undefined, "https://app.example.com/"],
		["not-a-url", "https://app.example.com/"],
		["https://client.example", "https://client.example/"],
	])("window origin %s", (origin, expected) => {
		vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://app.example.com");
		vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF", "master");
		setWindow({ location: origin === undefined ? {} : { origin } });

		expect(getBaseURL().toString()).toBe(expected);
	});

	it("fails when production has no configured origin", () => {
		vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF", "master");

		expect(() => getBaseURL()).toThrow("Production origin is not configured");
	});

	it.each(["app.example.com", "http://app.example.com", "ftp://app.example.com"])(
		"rejects %s as the production origin instead of falling back",
		(configured) => {
			vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF", "master");
			vi.stubEnv("NEXT_PUBLIC_BASE_URL", configured);
			vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "example.com");

			expect(() => getBaseURL()).toThrow("Production origin is not configured");
		}
	);
});
