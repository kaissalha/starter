/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import { generateLocalizedMetadata, generateLocalizedStaticParams, locales } from "@/i18n/routing";

describe("generateLocalizedStaticParams", () => {
	it("should include entries for all locales", () => {
		const params = generateLocalizedStaticParams();

		locales.forEach((locale) => {
			expect(params).toContainEqual({ locale });
		});
	});
});

describe("generateLocalizedMetadata", () => {
	it("should use a self-referencing canonical for ar", () => {
		const metadata = generateLocalizedMetadata({ locale: "ar", pathname: "/", title: "T" });

		expect(metadata.alternates?.canonical).toBe("/ar");
		expect(metadata.alternates?.languages).toEqual({ ar: "/ar", en: "/", "x-default": "/" });
	});

	it("should keep x-default english for ar privacy", () => {
		const metadata = generateLocalizedMetadata({ locale: "ar", pathname: "/privacy", title: "T" });

		expect(metadata.alternates?.canonical).toBe("/ar/privacy");
		expect(metadata.alternates?.languages).toMatchObject({ "x-default": "/privacy" });
	});

	it("should fall back to english for an unknown locale", () => {
		expect(
			generateLocalizedMetadata({ locale: "fr", pathname: "/privacy", title: "T" }).alternates?.canonical
		).toBe("/privacy");
	});

	it("should emit open graph and twitter metadata", () => {
		const en = generateLocalizedMetadata({ description: "D", locale: "en", title: "Title" });
		const ar = generateLocalizedMetadata({ locale: "ar", pathname: "/privacy", title: "Title" });

		expect(en.openGraph).toMatchObject({ locale: "en_US", title: "Title", url: "/" });
		expect(ar.openGraph).toMatchObject({ locale: "ar_AR", title: "Title", url: "/ar/privacy" });
		expect(en.twitter).toMatchObject({ card: "summary" });
	});
});
