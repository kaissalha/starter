import { describe, expect, it } from "vitest";

import { brandFoundationSchema } from "../src/brand-foundation";
import { brandFoundationFixture } from "./fixtures/brand-foundation";

describe("Brand foundation v1", () => {
	it("normalizes and parses a bilingual foundation", () => {
		const parsed = brandFoundationSchema.parse(brandFoundationFixture);

		expect(parsed.colors).toMatchObject({
			background: "#ffffff",
			neutral: "#2d4059",
			primary: "#ea5455",
			secondary: "#f07b3f",
			tertiary: "#ffd460",
		});
	});

	it("requires the default locale in locales", () => {
		const result = brandFoundationSchema.safeParse({
			...brandFoundationFixture,
			defaultLocale: "fr",
		});

		expect(result.success).toBe(false);

		if (result.success) {
			return;
		}

		expect(result.error.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: ["defaultLocale"] })])
		);
	});

	it("rejects duplicate locales after canonicalization", () => {
		const result = brandFoundationSchema.safeParse({
			...brandFoundationFixture,
			locales: ["en", "EN", "ar"],
		});

		expect(result.success).toBe(false);

		if (result.success) {
			return;
		}

		expect(result.error.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: ["locales", 1] })])
		);
	});

	it("accepts an https logo within the scale bounds", () => {
		const logo = { scale: 1.2, src: "https://store.public.blob.vercel-storage.com/logo.svg" };

		expect(brandFoundationSchema.parse({ ...brandFoundationFixture, logo }).logo).toEqual(logo);
	});

	it.each([
		{ scale: 1, src: "http://example.com/logo.png" },
		{ scale: 1, src: "data:image/svg+xml,%3Csvg%2F%3E" },
		{ scale: 3, src: "https://example.com/logo.png" },
	])("rejects logo $src at scale $scale", (logo) => {
		expect(brandFoundationSchema.safeParse({ ...brandFoundationFixture, logo }).success).toBe(false);
	});

	it("rejects unknown root fields", () => {
		expect(brandFoundationSchema.safeParse({ ...brandFoundationFixture, website: {} }).success).toBe(false);
	});

	it("rejects catalog-invalid fonts before consumers receive the Brand", () => {
		expect(
			brandFoundationSchema.safeParse({
				...brandFoundationFixture,
				typography: {
					...brandFoundationFixture.typography,
					body: { default: { fontId: "missing", weight: 400 } },
				},
			}).success
		).toBe(false);
	});

	it("requires resolved fonts to cover every declared locale", () => {
		expect(
			brandFoundationSchema.safeParse({
				...brandFoundationFixture,
				typography: {
					body: { default: { fontId: "inter", weight: 400 } },
					catalogVersion: 1,
					heading: { default: { fontId: "outfit", weight: 600 } },
				},
			}).success
		).toBe(false);
	});
});
