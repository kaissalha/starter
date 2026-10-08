import {
	brandFontPairings,
	brandFoundationSchema,
	brandPalettePresets,
	type BrandFoundationV1,
} from "@starter/infinite-brand";

import { parseSiteDocument } from "../document/document-validation";
import { listSectionContentPointers } from "../document/section-content-contract";
import type { Iso6391LanguageCode } from "../language-codes";
import { sectionDefinitions } from "../section-registry";
import { entityIdFromSeed } from "../sections/entity-id";
import type { SectionDefinition } from "../sections/section-definition";
import { templateDefinitions } from "../template-registry";
import { getTemplateBrand } from "../templates/template-brand";
import { instantiateTemplate, type TemplateContent, type TemplateDefinition } from "../templates/template-definition";
import { websiteSnapshotSchema, type WebsiteBriefV1 } from "./contracts";
import { listWebsiteLocalizations, readDefaultWebsiteLocalization, type WebsiteLocalizations } from "./localizations";

export const websiteGenerationSectionCategories = [
	"hero",
	"content",
	"features",
	"gallery",
	"faq",
	"call-to-action",
	"contact",
] as const;

export type WebsiteGenerationSectionCategory = (typeof websiteGenerationSectionCategories)[number];

type WebsiteGenerationSectionDefinition = SectionDefinition & { category: WebsiteGenerationSectionCategory };

const factDependentTextPointer =
	/(?:^|[-_/])(?:address|award|cost|credential|email|fee|founded|history|hours?|metric|number|person|phone|price|pricing|quote|rate|statistic|team|testimonial)(?:$|[-_/])/iu;

const isWebsiteGenerationSection = (section: SectionDefinition): section is WebsiteGenerationSectionDefinition =>
	section.supportsGeneration !== false &&
	(section.category !== "contact" || section.pattern === "contact-form") &&
	websiteGenerationSectionCategories.some((category) => category === section.category) &&
	listSectionContentPointers({ definition: section, kind: "text" }).every(
		(pointer) => !factDependentTextPointer.test(pointer)
	);

export const websiteGenerationSectionDefinitions = sectionDefinitions.filter(isWebsiteGenerationSection);

const generationKeywords = {
	"airy-spacious": ["agency", "creative", "interior", "photography", "studio", "وكالة", "ابداع", "تصوير", "استوديو"],
	"alpina-ventures": ["adventure", "outdoor", "tour", "travel", "tourism", "مغامرات", "رحلات", "سفر", "سياحة"],
	"artisan-craft": ["artisan", "ceramics", "craft", "handmade", "maker", "حرف", "خزف", "فخار", "يدوية"],
	"artistic-expression": ["art", "artist", "exhibition", "gallery", "فن", "فنون", "فنان", "معرض"],
	"clay-cool": [
		"architecture",
		"bakery",
		"cafe",
		"coffee",
		"creative",
		"design",
		"food",
		"interior",
		"restaurant",
		"studio",
		"مقهى",
		"قهوة",
		"مخبز",
		"مطعم",
		"طعام",
	],
	"growth-engine": ["growth", "marketing", "saas", "software", "startup", "تسويق", "نمو", "برمجيات", "ناشئة"],
	"heritage-drive": ["automotive", "car", "garage", "mechanic", "transport", "سيارات", "ميكانيكا", "كراج", "نقل"],
	"honest-craft": ["builder", "carpentry", "construction", "contractor", "renovation", "نجارة", "مقاولات", "بناء"],
	"midnight-aurora": ["ai", "digital", "software", "startup", "technology", "ذكاء اصطناعي", "رقمية", "تقنية"],
	"modern-foundation": [
		"architecture",
		"construction",
		"property",
		"real estate",
		"renovation",
		"عقارات",
		"عمارة",
		"ترميم",
	],
	"nordic-edge": ["hospitality", "local", "ضيافة", "محلي"],
	"paw-voyage": ["animal", "dog", "pet", "veterinary", "walking", "حيوانات", "اليفة", "بيطرية", "كلاب"],
	"professional-structure": [
		"accounting",
		"consulting",
		"finance",
		"legal",
		"professional",
		"محاسبة",
		"محاماة",
		"قانونية",
	],
	"pure-vitality": ["fitness", "gym", "health", "nutrition", "wellness", "لياقة", "رياضة", "تغذية", "صحة"],
	"reliable-core": [
		"engineering",
		"infrastructure",
		"security",
		"technology",
		"utilities",
		"هندسة",
		"بنية تحتية",
		"امن",
	],
	"serene-wellness": ["beauty", "massage", "spa", "therapy", "wellness", "تجميل", "تدليك", "سبا", "استرخاء"],
	"sharp-signal": [
		"advertising",
		"creative",
		"media",
		"production",
		"studio",
		"اعلان",
		"اعلانات",
		"وكالة اعلانات",
		"اعلام",
		"انتاج",
	],
	"sparkle-home": ["cleaning", "cleaner", "housekeeping", "janitorial", "maid", "تنظيف", "نظافة"],
	"steady-ascent": ["coaching", "education", "finance", "learning", "training", "تدريب", "تعليم", "تعلم"],
	"strategic-insight": ["advisory", "consulting", "finance", "strategy", "wealth", "استشارات", "استثمار", "ثروات"],
	"true-exposure": ["film", "media", "photography", "production", "videography", "افلام", "فيديو", "سينما"],
	"urban-edge": ["apparel", "fashion", "retail", "streetwear", "urban", "ازياء", "ملابس", "تجزئة"],
	"vibrant-blooms": [
		"florist",
		"flowers",
		"garden",
		"wedding",
		"events",
		"زهور",
		"ورود",
		"حدائق",
		"اعراس",
		"مناسبات",
	],
} satisfies Record<string, Array<string>>;

export const generationPageKeys = ["home", "about", "services", "faq", "contact"] as const;

export const websiteGenerationLocales = ["en", "ar"] satisfies Array<Iso6391LanguageCode>;

export type GenerationPageKey = (typeof generationPageKeys)[number];

export type WebsiteGenerationPlan = {
	kind: "plan";
	pages: Array<{ description: string; pageKey: string; title: string }>;
	siteDescription: string;
};

export type GenerationSectionSlot = {
	area: "header" | "footer" | "page";
	definition: SectionDefinition;
	index: number;
	pageKey?: string;
	purpose: string;
	required: boolean;
	slotKey: string;
};

export type WebsiteGenerationProfile = {
	keywords: Array<string>;
	layout: { footer: Array<GenerationSectionSlot>; header: Array<GenerationSectionSlot> };
	name: string;
	pages: Record<string, { slots: Array<GenerationSectionSlot>; slug: string }>;
	sections: Array<WebsiteGenerationSectionDefinition>;
	templateId: string;
};

const pageRecipes = {
	about: [
		{ categories: ["hero"], purpose: "Introduce the business's character and point of view." },
		{
			categories: ["content", "features"],
			purpose: "Explain how the business thinks and works without inventing its history.",
		},
		{
			categories: ["gallery", "features"],
			purpose: "Show the qualities customers should notice in the work or experience.",
		},
		{
			categories: ["call-to-action", "faq", "features"],
			purpose: "Connect the business story to a relevant next step.",
		},
	],
	contact: [
		{ categories: ["hero"], purpose: "Invite visitors to send an inquiry through the form below." },
		{ categories: ["contact"], purpose: "Let visitors send a message using the working contact form." },
		{
			categories: ["content", "features"],
			purpose:
				"Explain which details help the business understand an inquiry; do not repeat the form introduction.",
		},
		{
			categories: ["call-to-action"],
			purpose: "Offer navigation back to the business's services without promising a response time.",
		},
	],
	faq: [
		{ categories: ["hero"], purpose: "Set a practical, reassuring expectation for common questions." },
		{
			categories: ["faq", "content"],
			purpose: "Answer practical questions; turn unknown details into an invitation to ask, not a guess.",
		},
		{
			categories: ["content", "features"],
			purpose: "Explain what a customer can reasonably expect from the experience.",
		},
		{
			categories: ["call-to-action", "gallery", "features"],
			purpose: "Offer a clear next step for questions the page cannot answer.",
		},
	],
	home: [
		{ categories: ["hero"], purpose: "State the business's clearest promise and local relevance." },
		{
			categories: ["features", "content"],
			purpose: "Explain the main value customers can expect without inventing named services.",
		},
		{
			categories: ["gallery", "features"],
			purpose: "Make the work or customer experience tangible through concrete outcomes.",
		},
		{
			categories: ["content", "features"],
			purpose: "Build trust with an honest explanation of the business's approach.",
		},
		{
			categories: ["faq", "content", "features"],
			purpose: "Remove common uncertainty using only information grounded in the brief.",
		},
		{
			categories: ["call-to-action", "gallery"],
			purpose: "Invite one clear next step without inventing a contact method.",
		},
	],
	services: [
		{ categories: ["hero"], purpose: "Frame the customer need and the broad value the business provides." },
		{
			categories: ["features"],
			purpose: "Organize broad capabilities implied by the business type without naming unsupported offers.",
		},
		{
			categories: ["features", "content"],
			offset: 1,
			purpose: "Explain a simple customer-centered way of working without claiming a fixed process.",
		},
		{
			categories: ["content", "gallery"],
			purpose: "Clarify useful outcomes in plain language without guarantees or statistics.",
		},
		{
			categories: ["call-to-action", "faq", "gallery"],
			purpose: "Help an interested customer take the next step.",
		},
	],
} satisfies Record<GenerationPageKey, Array<{ categories: Array<string>; offset?: number; purpose: string }>>;

const readSection = ({
	categories,
	excluded,
	offset = 0,
	pick,
	sections,
	siteUsed,
}: {
	categories: Array<string>;
	excluded: Set<SectionDefinition>;
	offset?: number;
	pick: (candidates: Array<SectionDefinition>) => SectionDefinition | undefined;
	sections: Array<SectionDefinition>;
	siteUsed?: Set<SectionDefinition>;
}) => {
	const readAvailable = (isUsed: (section: SectionDefinition) => boolean) =>
		categories
			.map((category) => sections.filter((section) => section.category === category && !isUsed(section)))
			.find((matching) => matching.length > 0);

	const matching =
		readAvailable((section) => excluded.has(section) || siteUsed?.has(section) === true) ??
		readAvailable((section) => excluded.has(section));

	if (matching) {
		return pick(matching);
	}

	const reusable = sections.filter((section) => section.category !== "contact" || categories.includes("contact"));
	const remaining = reusable.filter((section) => !excluded.has(section));

	return remaining[offset % remaining.length] ?? reusable[offset % reusable.length];
};

export const createPageSlots = ({
	draw,
	pageKey,
	recipes,
	sections,
	siteUsed,
}: {
	draw?: (input: { candidates: Array<SectionDefinition>; index: number }) => SectionDefinition | undefined;
	pageKey: string;
	recipes: Array<{ categories: Array<string>; offset?: number; purpose: string }>;
	sections: Array<SectionDefinition>;
	siteUsed?: Set<SectionDefinition>;
}) => {
	const excluded = new Set<SectionDefinition>();

	return recipes.map((recipe, index) => {
		const definition = readSection({
			excluded,
			pick: (candidates) =>
				draw ? draw({ candidates, index }) : candidates[(recipe.offset ?? 0) % candidates.length],
			sections,
			siteUsed,
			...recipe,
		});

		if (!definition) {
			throw new Error(`Page "${pageKey}" does not have enough generation-safe sections`);
		}

		excluded.add(definition);
		siteUsed?.add(definition);

		return {
			area: "page" as const,
			definition,
			index,
			pageKey,
			purpose: recipe.purpose,
			required: index < 2 || index === recipes.length - 1,
			slotKey: `pages.${pageKey}.${index}-${definition.pattern}`,
		};
	});
};

const createProfilePage = ({
	pageKey,
	sections,
}: {
	pageKey: GenerationPageKey;
	sections: Array<SectionDefinition>;
}) => ({
	slots: createPageSlots({ pageKey, recipes: pageRecipes[pageKey], sections }),
	slug: pageKey,
});

const createGenerationProfile = ({ template }: { template: TemplateDefinition }) => {
	const safeSections = [
		...new Set([
			...Object.values(template.pages).flatMap((page) =>
				Object.values(page.sections).filter(isWebsiteGenerationSection)
			),
			...websiteGenerationSectionDefinitions.filter(({ category }) => category === "contact"),
		]),
	];

	if (safeSections.length === 0) {
		throw new Error(`Template "${template.id}" has no generation-safe sections`);
	}

	const headerDefinition = Object.values(template.layout.header)[0];
	const footerDefinition = Object.values(template.layout.footer)[0];

	if (!headerDefinition || !footerDefinition) {
		throw new Error(`Template "${template.id}" needs one header and footer for generation`);
	}

	return {
		keywords: Object.entries(generationKeywords).find(([templateId]) => templateId === template.id)?.[1] ?? [],
		layout: {
			footer: [
				{
					area: "footer",
					definition: footerDefinition,
					index: 0,
					purpose: "Close the site with useful navigation and a restrained business summary.",
					required: true,
					slotKey: "layout.footer",
				},
			],
			header: [
				{
					area: "header",
					definition: headerDefinition,
					index: 0,
					purpose: "Identify the business and provide concise navigation across the generated pages.",
					required: true,
					slotKey: "layout.header",
				},
			],
		},
		name: template.name,
		pages: Object.fromEntries(
			generationPageKeys.map((pageKey) => [pageKey, createProfilePage({ pageKey, sections: safeSections })])
		),
		sections: safeSections,
		templateId: template.id,
	} satisfies WebsiteGenerationProfile;
};

export const websiteGenerationProfiles = templateDefinitions.map((template) => createGenerationProfile({ template }));

export const rankWebsiteGenerationProfiles = ({ businessType }: { businessType: string }) => {
	const normalized = ` ${businessType
		.normalize("NFKD")
		.toLocaleLowerCase()
		.replaceAll(/\p{M}/gu, "")
		.replaceAll(/[^\p{L}\p{N} ]/gu, " ")
		.replaceAll(/\s+/gu, " ")
		.trim()} `;

	return websiteGenerationProfiles.map((profile) => ({
		profile,
		score: profile.keywords.filter(
			(keyword) => normalized.includes(` ${keyword} `) || normalized.includes(` ال${keyword} `)
		).length,
	}));
};

export const selectWebsiteGenerationProfile = ({ businessType }: { businessType: string }) => {
	const selected = rankWebsiteGenerationProfiles({ businessType }).reduce((best, candidate) =>
		candidate.score > best.score ? candidate : best
	);

	if (selected.score > 0) {
		return selected.profile;
	}

	const fallback = websiteGenerationProfiles.find((profile) => profile.templateId === "nordic-edge");

	if (!fallback) {
		throw new Error("Nordic Edge generation profile is missing");
	}

	return fallback;
};

export const createGenerationTemplateBrand = ({
	locale,
	profile,
}: {
	locale: Iso6391LanguageCode;
	profile: WebsiteGenerationProfile;
}) => {
	const brand =
		profile.templateId === "custom"
			? brandFoundationSchema.parse({
					colors: brandPalettePresets[0]!.colors,
					corners: { style: "soft" },
					defaultLocale: locale,
					locales: ["en", "ar"],
					schemaVersion: 1,
					typography: { catalogVersion: 1, ...brandFontPairings.minimal },
				})
			: getTemplateBrand({ logo: false, templateId: profile.templateId });

	return {
		...brand,
		defaultLocale: locale,
	};
};

export const validateWebsiteGenerationPlan = ({
	expectedPageKeys = generationPageKeys,
	plan,
}: {
	expectedPageKeys?: ReadonlyArray<string>;
	plan: WebsiteGenerationPlan;
}) => {
	const pageKeys = plan.pages.map((page) => page.pageKey);

	if (
		pageKeys.length !== expectedPageKeys.length ||
		pageKeys.some((pageKey, index) => pageKey !== expectedPageKeys[index])
	) {
		throw new Error("Website generation must return the selected pages in catalog order");
	}

	return plan;
};

export const listGenerationSlots = ({ profile }: { profile: WebsiteGenerationProfile }) => [
	...profile.layout.header,
	...Object.values(profile.pages).flatMap(({ slots }) => slots),
	...profile.layout.footer,
];

export const createWebsiteGenerationShell = ({
	brand,
	brief,
	localizations,
	profile,
	websiteId,
}: {
	brand?: BrandFoundationV1 | null;
	brief: WebsiteBriefV1;
	localizations: WebsiteLocalizations<WebsiteGenerationPlan>;
	profile: WebsiteGenerationProfile;
	websiteId: string;
}) => {
	const selectedLocalizations = listWebsiteLocalizations({ localizations }).map(({ locale, value }) => ({
		locale,
		plan: validateWebsiteGenerationPlan({ expectedPageKeys: Object.keys(profile.pages), plan: value }),
	}));

	const selected = validateWebsiteGenerationPlan({
		expectedPageKeys: Object.keys(profile.pages),
		plan: readDefaultWebsiteLocalization({ localizations }),
	});

	const pages = Object.fromEntries(
		selected.pages.map((page) => [page.pageKey, { home: page.pageKey === "home", sections: {} }])
	);

	const definition: TemplateDefinition = {
		defaultLocale: localizations.defaultLocale,
		description: `${profile.name} generated website.`,
		documentVersion: 1,
		id: profile.templateId,
		layout: { footer: {}, header: {} },
		locales: selectedLocalizations.map(({ locale: contentLocale }) => contentLocale),
		name: profile.name,
		pages,
		tags: [],
	};

	const content = Object.fromEntries(
		selectedLocalizations.map(({ locale: contentLocale, plan }) => [
			contentLocale,
			{
				layout: { footer: {}, header: {} },
				pages: Object.fromEntries(
					plan.pages.map((page) => {
						const profilePage = Object.entries(profile.pages).find(
							([pageKey]) => pageKey === page.pageKey
						)?.[1];

						if (!profilePage) {
							throw new Error(`Website generation profile is missing page "${page.pageKey}"`);
						}

						return [
							page.pageKey,
							{
								page: {
									route: { slug: profilePage.slug },
									seo: { description: page.description, title: page.title },
								},
								sections: {},
							},
						];
					})
				),
				site: { description: plan.siteDescription, name: brief.name },
			},
		])
	) satisfies TemplateContent;

	return websiteSnapshotSchema.parse({
		assets: {},
		brand: brand
			? { ...brand, defaultLocale: localizations.defaultLocale }
			: createGenerationTemplateBrand({ locale: localizations.defaultLocale, profile }),
		document: parseSiteDocument(
			instantiateTemplate({
				content,
				createId: ({ kind, path }) =>
					entityIdFromSeed({ seed: `${websiteId}:${profile.templateId}:${kind}:${path}` }),
				definition,
				path: `/websites/${websiteId}`,
			})
		),
		schemaVersion: 1,
		templateId: profile.templateId,
	});
};
