import { describe, expect, it } from "vitest";

import { resolveSectionContentReference } from "../src/document/content-schema";
import { entityIdFromSeed } from "../src/sections/entity-id";

const pageId = entityIdFromSeed({ seed: "localization:page" });

const contentId = entityIdFromSeed({ seed: "localization:section-content" });

const content = {
	ar: {
		pages: { [pageId]: { title: "الرئيسية" } },
		sections: { [contentId]: { heading: "مرحباً" } },
		site: { name: "مثال" },
	},
	en: {
		pages: { [pageId]: { title: "Home" } },
		sections: { [contentId]: { body: "Default body", heading: "Welcome" } },
		site: { name: "Example" },
	},
};

describe("locale-first content resolution", () => {
	it("resolves the requested ISO 639 locale before the default locale", () => {
		expect(
			resolveSectionContentReference({
				content,
				contentId,
				defaultLocale: "en",
				locale: "ar",
				reference: { $text: "/heading" },
			})
		).toBe("مرحباً");
	});

	it("falls back per semantic pointer without copying the whole locale", () => {
		expect(
			resolveSectionContentReference({
				content,
				contentId,
				defaultLocale: "en",
				locale: "ar",
				reference: { $text: "/body" },
			})
		).toBe("Default body");
	});
});
