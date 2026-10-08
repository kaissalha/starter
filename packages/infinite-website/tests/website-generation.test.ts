import { describe, expect, it } from "vitest";

import {
	drawNearBest,
	resolveWebsiteGenerationProfile,
	websiteWritingVoice,
	websiteBriefSchema,
	createGenerationTemplateBrand,
	createSectionTextContentFromFields,
	createSectionTextContentSchema,
	createWebsiteGenerationShell,
	listGenerationSlots,
	listSectionContentPointers,
	parseSiteDocument,
	selectWebsiteGenerationProfile,
	validateWebsiteGenerationPlan,
	websiteAssetBindingsSchema,
	websiteGenerationProfiles,
	type GenerationPageKey,
} from "../src/generation";

const representativeBusinessTypes = {
	"airy-spacious": "photography agency",
	"alpina-ventures": "adventure tours",
	"artisan-craft": "ceramics workshop",
	"artistic-expression": "art gallery",
	"clay-cool": "coffee shop",
	"growth-engine": "growth software",
	"heritage-drive": "automotive garage",
	"honest-craft": "carpentry contractor",
	"midnight-aurora": "AI platform",
	"modern-foundation": "property company",
	"nordic-edge": "local hospitality",
	"paw-voyage": "pet walking",
	"professional-structure": "accounting firm",
	"pure-vitality": "gym",
	"reliable-core": "engineering company",
	"serene-wellness": "spa",
	"sharp-signal": "advertising bureau",
	"sparkle-home": "cleaning service",
	"steady-ascent": "coaching practice",
	"strategic-insight": "advisory firm",
	"true-exposure": "videography collective",
	"urban-edge": "apparel shop",
	"vibrant-blooms": "florist",
} satisfies Record<string, string>;

const allPages = ["home", "about", "services", "faq", "contact"] satisfies Array<GenerationPageKey>;

describe("website generation profiles", () => {
	it("stores asset bindings as a direct resolved-asset map", () => {
		const assetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

		expect(websiteAssetBindingsSchema.parse({ [assetId]: { src: "/hero.webp" } })).toEqual({
			[assetId]: { src: "/hero.webp" },
		});

		expect(websiteAssetBindingsSchema.safeParse({ [assetId]: { asset: { src: "/hero.webp" } } }).success).toBe(
			false
		);
	});

	it("covers all curated templates with deterministic representative matching", () => {
		expect(websiteGenerationProfiles).toHaveLength(23);

		websiteGenerationProfiles.forEach((profile) => {
			const businessType = representativeBusinessTypes[profile.templateId];
			expect(businessType).toBeDefined();

			expect(selectWebsiteGenerationProfile({ businessType: businessType ?? "" }).templateId).toBe(
				profile.templateId
			);
		});

		expect(selectWebsiteGenerationProfile({ businessType: "unmatched neighborhood kiosk" }).templateId).toBe(
			"nordic-edge"
		);
	});

	it.each([
		["وكالة تصوير", "airy-spacious"],
		["شركة رحلات وسفر", "alpina-ventures"],
		["ورشة خزف", "artisan-craft"],
		["معرض فني", "artistic-expression"],
		["شركة تنظيف", "sparkle-home"],
		["مَقْهَى القَهْوَة", "clay-cool"],
		["تسويق رقمي", "growth-engine"],
		["ورشة سيارات", "heritage-drive"],
		["شركة مقاولات", "honest-craft"],
		["منصة ذكاء اصطناعي", "midnight-aurora"],
		["شركة عقارات", "modern-foundation"],
		["ضيافة محلية", "nordic-edge"],
		["عيادة بيطرية", "paw-voyage"],
		["مكتب المحاسبة", "professional-structure"],
		["مركز لياقة", "pure-vitality"],
		["شركة هندسة", "reliable-core"],
		["صالون تجميل", "serene-wellness"],
		["وكالة إعلانات", "sharp-signal"],
		["مركز التعليم", "steady-ascent"],
		["مكتب استشارات", "strategic-insight"],
		["إنتاج أفلام فيديو", "true-exposure"],
		["متجر الأزياء", "urban-edge"],
		["متجر الزهور", "vibrant-blooms"],
		["خدمة غير معروفة", "nordic-edge"],
		["photographic unrelated", "nordic-edge"],
	])("matches bilingual whole-word business keywords for %s", (businessType, templateId) => {
		expect(selectWebsiteGenerationProfile({ businessType }).templateId).toBe(templateId);
	});

	it("builds every selected page with template-level section density", () => {
		websiteGenerationProfiles.forEach((profile) => {
			const slots = listGenerationSlots({ profile });
			expect(slots.length).toBeGreaterThanOrEqual(22);
			expect(slots.length).toBeLessThanOrEqual(25);

			expect(
				slots.reduce(
					(total, slot) =>
						total + listSectionContentPointers({ definition: slot.definition, kind: "asset" }).length,
					0
				)
			).toBeGreaterThan(0);

			expect(profile.pages.home.slots.length).toBeGreaterThanOrEqual(4);
			allPages.forEach((pageKey) => expect(profile.pages[pageKey].slots.length).toBeGreaterThanOrEqual(4));
		});
	});

	it("uses a text wordmark when generation has no uploaded logo", () => {
		websiteGenerationProfiles.forEach((profile) => {
			const [header] = profile.layout.header;
			expect(header).toBeDefined();

			if (!header) {
				return;
			}

			expect(listSectionContentPointers({ definition: header.definition, kind: "asset" })).toEqual([]);
			expect(listSectionContentPointers({ definition: header.definition, kind: "text" })).toContain(
				"/copy/header-main-brand"
			);
		});
	});

	it("creates parse-valid shells with stable IDs for every profile", () => {
		websiteGenerationProfiles.forEach((profile) => {
			const plan = {
				kind: "plan" as const,
				pages: allPages.map((pageKey) => ({
					description: `Information about ${pageKey}.`,
					pageKey,
					title: pageKey === "home" ? "Northstar" : `Northstar ${pageKey}`,
				})),
				siteDescription: "A grounded local business website.",
			};

			const input = {
				brief: { location: "Toronto", name: "Northstar", schemaVersion: 1 as const, type: "Studio" },
				localizations: { byLocale: { en: plan }, defaultLocale: "en" as const },
				profile,
				websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
			};

			const first = createWebsiteGenerationShell(input);
			const replay = createWebsiteGenerationShell(input);
			expect(parseSiteDocument(first.document)).toEqual(first.document);
			expect(replay.document).toEqual(first.document);
			expect(first.document.structure.pages).toHaveLength(5);
			expect(first.document.structure.pages.every((page) => page.sections.length === 0)).toBe(true);
		});
	});

	it("rejects invalid page plans before a shell is created", () => {
		expect(() =>
			validateWebsiteGenerationPlan({
				plan: {
					kind: "plan",
					pages: [{ description: "About this business.", pageKey: "about", title: "About" }],
					siteDescription: "Invalid.",
				},
			})
		).toThrow(/selected pages/u);
	});

	it("round-trips the provider-safe text field list into section content", () => {
		const profile = websiteGenerationProfiles[0];
		const slot = profile ? listGenerationSlots({ profile })[0] : undefined;
		expect(slot).toBeDefined();

		if (!slot) {
			return;
		}

		const fields = listSectionContentPointers({ definition: slot.definition, kind: "text" }).map((path) => ({
			path,
			value: `Generated value for ${path}`,
		}));

		const content = createSectionTextContentFromFields({ definition: slot.definition, fields });

		expect(createSectionTextContentSchema({ definition: slot.definition }).parse(content)).toEqual(content);

		expect(() =>
			createSectionTextContentFromFields({ definition: slot.definition, fields: fields.slice(1) })
		).toThrow(/do not match/u);

		expect(() =>
			createSectionTextContentFromFields({ definition: slot.definition, fields: fields.toReversed() })
		).toThrow(/do not match/u);
	});
});

describe("section-first generation", () => {
	const brief = { location: "Toronto", name: "Northstar", schemaVersion: 1 as const, type: "accounting firm" };

	it.each(["accounting firm", "coffee shop", "وكالة تصوير", "خدمة غير معروفة"])(
		"composes %s without a named theme",
		(type) => {
			const input = { brief: { ...brief, type } };
			const profile = resolveWebsiteGenerationProfile(input);
			expect(profile.templateId).toBe("custom");
			expect(resolveWebsiteGenerationProfile(input)).toEqual(profile);
			expect(
				profile.pages.contact.slots.some(
					({ definition, required }) => definition.pattern === "contact-form" && required
				)
			).toBe(true);
			expect(listGenerationSlots({ profile }).length).toBeLessThan(25);
			expect(createGenerationTemplateBrand({ locale: "ar", profile }).colors.background).toBe("#ffffff");
			expect(profile.sections.length).toBeGreaterThan(10);
		}
	);

	it("allows photo sections but no galleries for advice-based businesses", () => {
		const profile = resolveWebsiteGenerationProfile({ brief });
		expect(listGenerationSlots({ profile }).some(({ definition }) => definition.category === "gallery")).toBe(
			false
		);
		expect(
			listGenerationSlots({ profile }).some(
				({ definition }) => listSectionContentPointers({ definition, kind: "asset" }).length > 0
			)
		).toBe(true);
	});

	it.each(["accounting firm", "coffee shop", "law firm", "florist", "وكالة تصوير"])(
		"never repeats a section across the pages of a %s site",
		(type) => {
			const profile = resolveWebsiteGenerationProfile({ brief: { ...brief, type } });

			const patterns = Object.values(profile.pages).flatMap(({ slots }) =>
				slots.map(({ definition }) => definition.pattern)
			);

			const openings = Object.values(profile.pages).map(({ slots }) => slots[0]?.definition);

			expect(new Set(patterns).size).toBe(patterns.length);
			expect(openings.every((definition) => definition?.category === "hero")).toBe(true);
			expect(patterns).not.toContain("blog-latest-three");
			expect(patterns).not.toContain("blog-latest-six");
		}
	);

	it("draws different layouts, headers, and footers for different businesses", () => {
		const profiles = ["Northstar", "Harbor", "Cedar", "Atlas", "Juniper", "Meridian"].map((name) =>
			resolveWebsiteGenerationProfile({ brief: { ...brief, name } })
		);

		const homes = new Set(profiles.map(({ pages }) => pages.home?.slots[0]?.definition.pattern));

		const layouts = new Set(
			profiles.map(
				({ layout }) => `${layout.header[0]?.definition.pattern}:${layout.footer[0]?.definition.pattern}`
			)
		);

		expect(homes.size).toBeGreaterThan(1);
		expect(layouts.size).toBeGreaterThan(1);
	});

	it("draws near the best weighted candidates and stays deterministic per seed", () => {
		const candidates = [
			{ id: "best", weight: 1 },
			{ id: "near", weight: 0.6 },
			{ id: "far", weight: 0.2 },
		];

		const draws = Array.from({ length: 200 }, (_, index) =>
			drawNearBest({ candidates, seed: `seed-${index}`, weight: ({ weight }) => weight })
		);

		expect(new Set(draws.map((draw) => draw?.id))).toEqual(new Set(["best", "near"]));
		expect(drawNearBest({ candidates, seed: "seed-1", weight: ({ weight }) => weight })).toBe(draws[1]);
		expect(drawNearBest({ candidates: [], seed: "seed", weight: () => 1 })).toBeUndefined();
	});

	it("uses supplied facts to enable menu and portfolio pages and validates both locale plans against them", () => {
		const profile = resolveWebsiteGenerationProfile({
			brief: { ...brief, menu: ["Espresso"], portfolio: ["Coffee cart at a local event"] },
		});

		const keys = Object.keys(profile.pages);
		expect(keys).toEqual(["home", "about", "menu", "portfolio", "contact"]);

		const plan = {
			kind: "plan" as const,
			pages: keys.map((pageKey) => ({ description: pageKey, pageKey, title: pageKey })),
			siteDescription: "A local business.",
		};

		expect(() =>
			createWebsiteGenerationShell({
				brief,
				localizations: { byLocale: { ar: plan, en: plan }, defaultLocale: "en" },
				profile,
				websiteId: "custom-site",
			})
		).not.toThrow();
		expect(() => validateWebsiteGenerationPlan({ expectedPageKeys: allPages, plan })).toThrow("selected pages");
		expect(Object.keys(resolveWebsiteGenerationProfile({ brief: { ...brief, type: "cafe" } }).pages)).not.toContain(
			"menu"
		);
	});

	it("keeps explicitly selected templates and a shared overridable writing voice", () => {
		expect(resolveWebsiteGenerationProfile({ brief, templateId: "clay-cool" }).templateId).toBe("clay-cool");
		expect(websiteWritingVoice({ brief })).toBe(websiteWritingVoice({ brief }));
		expect(
			new Set(
				["Northstar", "Harbor", "Cedar", "Atlas", "Juniper", "Meridian"].map((name) =>
					websiteWritingVoice({ brief: { ...brief, name } })
				)
			).size
		).toBeGreaterThan(1);
		expect(websiteWritingVoice({ brief: { ...brief, voice: "Friendly and concise" } })).toBe(
			"Friendly and concise"
		);
		expect(
			websiteBriefSchema.safeParse({
				...brief,
				details: "Open Monday to Friday.",
				menu: ["Espresso"],
				voice: "Friendly",
			}).success
		).toBe(true);
		expect(websiteBriefSchema.safeParse({ ...brief, menu: [""] }).success).toBe(false);
	});
});
