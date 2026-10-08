import { describe, expect, it } from "vitest";

import type { SiteDocument } from "@starter/infinite-website/contracts";

import { inspectWebsiteSeo } from "../../src/services/seo/overview";

const homeId = "11111111-1111-4111-8111-111111111111";

const aboutId = "22222222-2222-4222-8222-222222222222";

const locales: SiteDocument["locales"] = ["en", "ar"];

const document: SiteDocument = {
	content: {
		ar: {
			pages: {
				[aboutId]: { route: { slug: "من-نحن" }, seo: { title: "من نحن" } },
				[homeId]: { route: { slug: "الرئيسية" }, seo: { title: "الرئيسية" } },
			},
			sections: {},
			site: { name: "مثال" },
		},
		en: {
			pages: {
				[aboutId]: { route: { slug: "about" }, seo: { title: "Example" } },
				[homeId]: { route: { slug: "home" }, seo: { title: "Example" } },
			},
			sections: {},
			site: { description: "A useful description", name: "Example" },
		},
	},
	defaultLocale: "en",
	documentVersion: 1,
	locales,
	structure: {
		layout: { footer: [], header: [] },
		pages: [
			{ home: true, id: homeId, sections: [] },
			{ home: false, id: aboutId, sections: [] },
		],
	},
};

describe("inspectWebsiteSeo", () => {
	it("reports duplicate titles within a locale and uses actual localized paths", () => {
		expect(inspectWebsiteSeo(document)).toContainEqual({
			code: "duplicateTitle",
			locale: "en",
			observed: "Example",
			pageId: aboutId,
			path: "/about",
		});
	});

	it("reports missing descriptions when neither the page nor site has one", () => {
		const withoutDescription: SiteDocument = {
			...document,
			content: {
				...document.content,
				en: { ...document.content.en!, site: { name: "Example" } },
			},
		};

		expect(inspectWebsiteSeo(withoutDescription)).toContainEqual({
			code: "missingDescription",
			locale: "ar",
			observed: "",
			pageId: homeId,
			path: "/ar",
		});
		expect(inspectWebsiteSeo(withoutDescription)).toContainEqual({
			code: "missingDescription",
			locale: "ar",
			observed: "",
			pageId: aboutId,
			path: "/ar/من-نحن",
		});
	});

	it("reports missing page headings from the published document", () => {
		expect(inspectWebsiteSeo(document)).toContainEqual({
			code: "missingH1",
			locale: "en",
			observed: "0",
			pageId: homeId,
			path: "/",
		});
	});
});
