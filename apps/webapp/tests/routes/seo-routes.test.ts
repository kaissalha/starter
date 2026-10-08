/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { pilotTemplateIds } from "@/app/[locale]/(site)/templates/pilot-templates";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import ar from "@/i18n/messages/ar.json";
import en from "@/i18n/messages/en.json";
import { templateDefinitions } from "@starter/infinite-website/catalog";
import { getTemplateBrand, templatePreviews } from "@starter/infinite-website/template-previews";

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
				"https://example.com/templates",
				"https://example.com/ar/templates",
				...pilotTemplateIds.flatMap((id) => [
					`https://example.com/templates/${id}`,
					`https://example.com/ar/templates/${id}`,
				]),
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

describe("pilot templates", () => {
	it.each(pilotTemplateIds)("should ship a definition, preview and brand for %s", (templateId) => {
		expect(templateDefinitions.some(({ id }) => id === templateId)).toBe(true);
		expect(templatePreviews.some(({ id }) => id === templateId)).toBe(true);
		expect(() => getTemplateBrand({ templateId })).not.toThrow();
	});

	it.each([
		["en", en],
		["ar", ar],
	])("should give every pilot complete %s copy", (_, catalog) => {
		expect(Object.keys(catalog.templates.items).sort()).toEqual([...pilotTemplateIds].sort());
		Object.values(catalog.templates.items).forEach((item) =>
			Object.values(item).forEach((value) => expect(value.trim()).not.toBe(""))
		);
	});
});
