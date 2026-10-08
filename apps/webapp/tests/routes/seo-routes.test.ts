/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

vi.mock("@starter/utils", () => ({ getBaseURL: () => new URL("https://example.com") }));

describe("robots", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("should allow the site and disallow private paths in production", () => {
		vi.stubEnv("VERCEL_ENV", "production");
		const result = robots();
		const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

		expect(rules?.allow).toBe("/");
		expect(rules?.disallow).toEqual(
			expect.arrayContaining([
				"/api/",
				"/dashboard",
				"/ar/dashboard",
				"/login",
				"/ar/login",
				"/oauth",
				"/onboarding",
				"/accept-invitation",
				"/ar/accept-invitation",
			])
		);
		expect(result.sitemap).toBe("https://example.com/sitemap.xml");
	});

	it.each(["preview", ""])("should disallow everything when VERCEL_ENV is %j", (env) => {
		vi.stubEnv("VERCEL_ENV", env);
		const result = robots();
		const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

		expect(rules?.disallow).toBe("/");
		expect(result.sitemap).toBeUndefined();
	});
});

describe("sitemap", () => {
	const entries = sitemap();
	const urls = entries.map((entry) => entry.url);

	it("should list every marketing page in both locales", () => {
		expect(urls).toEqual(
			expect.arrayContaining([
				"https://example.com/",
				"https://example.com/ar",
				"https://example.com/privacy",
				"https://example.com/ar/privacy",
				"https://example.com/terms",
				"https://example.com/ar/terms",
			])
		);
	});

	it("should link the locale pair for each entry", () => {
		entries.forEach((entry) => {
			const path = new URL(entry.url).pathname.replace(/^\/ar/, "") || "/";
			const prefix = path === "/" ? "" : path;

			expect(entry.alternates?.languages).toEqual({
				ar: `https://example.com/ar${prefix}`,
				en: `https://example.com${path}`,
			});
		});
	});
});
