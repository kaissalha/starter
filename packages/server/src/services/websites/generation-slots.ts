import { z } from "zod";

import {
	contactFormContent,
	entityIdFromSeed,
	generationSeedHash,
	isBusinessNameContentPointer,
	generationPageKeys,
	listSectionContentPointers,
	type GenerationSectionSlot,
	type SectionDefinition,
} from "@starter/infinite-website/generation";

import type { WebsiteGenerationPromptSlot, WebsiteGenerationTextFieldRole } from "../../ai/prompts";
import type { WebsiteAssetIntent } from "./assets";
import {
	listWebsiteDefinitionLinks,
	visitWebsiteDefinitionObjects,
	websiteNavigationLabel,
} from "./generation-actions";

export const websiteSectionLocalizationConcurrency = 34;

const MAX_STOCK_ASSETS = 32;

const headingApproaches = [
	"direct statement",
	"customer question",
	"concrete detail",
	"practical next step",
	"brief invitation",
	"plain explanation",
];

const stockRoleBySectionCategory = new Map<string, NonNullable<WebsiteAssetIntent["stockRole"]>>([
	["hero", "hero-background"],
	["content", "section-illustration"],
	["features", "section-illustration"],
	["gallery", "section-illustration"],
	["call-to-action", "section-illustration"],
]);

type WebsiteGenerationTextFieldOverride = Partial<{
	maxWords: number;
	minWords: number;
	role: WebsiteGenerationTextFieldRole;
}>;

const websiteGenerationFieldOverrides = {
	"cta-basic": {
		"/actions/0/label": { maxWords: 4 },
		"/actions/1/label": { maxWords: 4 },
	},
} satisfies Record<string, Record<string, WebsiteGenerationTextFieldOverride>>;

const textElementNodeSchema = z.compile(
	z.object({
		props: z.object({
			content: z.object({ $text: z.string() }),
			element: z.enum(["h1", "h2", "h3", "h4", "p", "span"]).optional(),
		}),
		type: z.literal("text"),
	})
);

const backgroundMediaNodeSchema = z.compile(
	z.object({
		props: z.object({
			assetId: z.object({ $asset: z.string() }),
			playback: z.literal("background"),
		}),
		type: z.literal("media"),
	})
);

const textElementRoles = new WeakMap<SectionDefinition, ReadonlyMap<string, WebsiteGenerationTextFieldRole>>();

const backgroundMediaPointers = new WeakMap<SectionDefinition, ReadonlySet<string>>();

export type WebsiteSectionGenerationSlot = {
	assetIntents: Array<WebsiteAssetIntent>;
	codeFields: Array<WebsiteGenerationCodeField>;
	fieldOrder: Array<string>;
	linkIntents: Array<{ path: string; targetPageKey: string }>;
	linkPointers: Array<string>;
	promptSlot: WebsiteGenerationPromptSlot;
	slot: Omit<GenerationSectionSlot, "definition"> & {
		category: GenerationSectionSlot["definition"]["category"];
		pattern: string;
	};
};

type WebsiteGenerationCodeField =
	| { ar: string; en: string; kind: "contact-copy"; path: string }
	| { kind: "navigation-label"; pageKey: string; path: string }
	| { control: WebsiteGenerationAccessibilityControl; kind: "accessibility"; path: string; subject: string | null }
	| { kind: "business-name"; path: string; value: string }
	| { kind: "copy"; path: string; sourcePath: string }
	| { kind: "index"; path: string; value: string };

type WebsiteGenerationAccessibilityControl =
	| "carousel"
	| "carousel-indicators"
	| "carousel-next"
	| "carousel-previous"
	| "mobile-navigation"
	| "navigation";

const carouselControlBySuffix = new Map<string, WebsiteGenerationAccessibilityControl>([
	["indicators", "carousel-indicators"],
	["next", "carousel-next"],
	["previous", "carousel-previous"],
]);

const headingRoleByElement = new Map<string, WebsiteGenerationTextFieldRole>([
	["h1", "heading-1"],
	["h2", "heading-2"],
	["h3", "heading"],
	["h4", "heading"],
]);

const accessibilitySubjectByLocale = {
	ar: {
		features: "الميزات",
		gallery: "معرض الصور",
		services: "الخدمات",
		testimonials: "قصص العملاء",
	},
	en: {
		features: "Features",
		gallery: "Gallery",
		services: "Services",
		testimonials: "Customer stories",
	},
} as const;

const readAccessibilitySubject = ({ locale, subject }: { locale: string; subject: string | null }) => {
	const language = locale === "ar" ? "ar" : "en";

	const known = Object.entries(accessibilitySubjectByLocale[language]).find(
		([candidate]) => candidate === subject
	)?.[1];

	return known ?? (language === "ar" ? "عرض الشرائح" : "Carousel");
};

const createAccessibilityValue = ({
	control,
	locale,
	subject,
}: {
	control: WebsiteGenerationAccessibilityControl;
	locale: string;
	subject: string | null;
}) => {
	if (locale === "ar") {
		if (control === "navigation") {
			return "التنقل الرئيسي";
		}

		if (control === "mobile-navigation") {
			return "القائمة";
		}

		const label = readAccessibilitySubject({ locale, subject });

		if (control === "carousel-previous") {
			return `${label}: الشريحة السابقة`;
		}

		if (control === "carousel-next") {
			return `${label}: الشريحة التالية`;
		}

		if (control === "carousel-indicators") {
			return `ترقيم صفحات ${label}`;
		}

		return label;
	}

	if (control === "navigation") {
		return "Primary navigation";
	}

	if (control === "mobile-navigation") {
		return "Menu";
	}

	const label = readAccessibilitySubject({ locale, subject });

	if (control === "carousel-previous") {
		return `${label}: previous slide`;
	}

	if (control === "carousel-next") {
		return `${label}: next slide`;
	}

	if (control === "carousel-indicators") {
		return `${label} pagination`;
	}

	return label;
};

const createWebsiteGenerationCodeField = ({
	businessName,
	category,
	index,
	path,
	paths,
}: {
	businessName: string;
	category: string;
	index: number;
	path: string;
	paths: ReadonlySet<string>;
}): WebsiteGenerationCodeField | null => {
	if (path.endsWith("-mobile-label")) {
		const sourcePath = path.replace(/-mobile-label$/u, "-label");

		if (paths.has(sourcePath)) {
			return { kind: "copy", path, sourcePath };
		}
	}

	if (/^\/navigation\/\d+\/dropdown\/\d+\/description$/u.test(path)) {
		const sourcePath = path.replace(/description$/u, "label");

		if (paths.has(sourcePath)) {
			return { kind: "copy", path, sourcePath };
		}
	}

	if (/(?:^|[-_/])index(?:$|[-_/])/iu.test(path)) {
		return { kind: "index", path, value: String(index) };
	}

	if (isBusinessNameContentPointer(path)) {
		return { kind: "business-name", path, value: businessName };
	}

	if (path === "/accessibility/navigationLabel") {
		return { control: "navigation", kind: "accessibility", path, subject: null };
	}

	if (path === "/accessibility/mobileNavigationLabel") {
		return { control: "mobile-navigation", kind: "accessibility", path, subject: null };
	}

	const carousel = path.match(
		/^\/accessibility\/(?:carousel-([a-z]+?)(previous|next|indicators)?|(carousel|previous|next|indicators))Label$/u
	);

	if (!carousel) {
		return null;
	}

	const [, subject, suffix, bare] = carousel;
	const control = carouselControlBySuffix.get(suffix ?? bare ?? "") ?? "carousel";

	return { control, kind: "accessibility", path, subject: subject ?? category };
};

export const resolveWebsiteGenerationFields = ({
	fields,
	generationSlot,
	locale,
}: {
	fields: Array<{ path: string; value: string }>;
	generationSlot: WebsiteSectionGenerationSlot;
	locale: string;
}) => {
	const expectedModelPaths = generationSlot.promptSlot.fields.map(({ path }) => path);

	if (
		fields.length !== expectedModelPaths.length ||
		fields.some(({ path }, index) => path !== expectedModelPaths[index])
	) {
		throw new Error("Generated model fields do not match the website section prompt contract");
	}

	const values = new Map(fields.map(({ path, value }) => [path, value]));
	const codeFields = new Map(generationSlot.codeFields.map((field) => [field.path, field]));

	const readValue = (path: string, resolving = new Set<string>()): string => {
		const modelValue = values.get(path);

		if (modelValue !== undefined) {
			return modelValue;
		}

		if (resolving.has(path)) {
			throw new Error(`Website generation field copy cycle at "${path}"`);
		}

		const field = codeFields.get(path);

		if (!field) {
			throw new Error(`Website generation field "${path}" has no model or code-owned value`);
		}

		if (field.kind === "contact-copy") {
			return locale === "ar" ? field.ar : field.en;
		}

		if (field.kind === "business-name" || field.kind === "index") {
			return field.value;
		}

		if (field.kind === "accessibility") {
			return createAccessibilityValue({ ...field, locale });
		}

		if (field.kind === "navigation-label") {
			return websiteNavigationLabel({ locale, pageKey: field.pageKey });
		}

		return readValue(field.sourcePath, new Set([...resolving, path]));
	};

	return generationSlot.fieldOrder.map((path) => ({ path, value: readValue(path) }));
};

const normalizeCollectionPointer = ({ pointer }: { pointer: string }) =>
	pointer.replaceAll("/items/", "/").replaceAll(/\/\d+(?=\/|$)/gu, "/*");

const listBackgroundMediaPointers = ({ definition }: { definition: SectionDefinition }) => {
	const existing = backgroundMediaPointers.get(definition);

	if (existing) {
		return existing;
	}

	const pointers = new Set<string>();

	visitWebsiteDefinitionObjects({
		definition,
		onObject: (object) => {
			const media = backgroundMediaNodeSchema.safeParse(object);

			if (media.success) {
				pointers.add(normalizeCollectionPointer({ pointer: media.data.props.assetId.$asset }));
			}
		},
	});
	backgroundMediaPointers.set(definition, pointers);

	return pointers;
};

export const resolveWebsiteAssetStockRole = ({
	area,
	definition,
	pointer,
}: {
	area: GenerationSectionSlot["area"];
	definition: SectionDefinition;
	pointer: string;
}): WebsiteAssetIntent["stockRole"] => {
	if (listBackgroundMediaPointers({ definition }).has(normalizeCollectionPointer({ pointer }))) {
		return definition.category === "hero" ? "hero-background" : "section-illustration";
	}

	if (area === "footer") {
		return "section-illustration";
	}

	return area === "page" ? (stockRoleBySectionCategory.get(definition.category) ?? null) : null;
};

const listTextElementRoles = ({ definition }: { definition: SectionDefinition }) => {
	const existing = textElementRoles.get(definition);

	if (existing) {
		return existing;
	}

	const roles = new Map<string, WebsiteGenerationTextFieldRole>();

	visitWebsiteDefinitionObjects({
		definition,
		onObject: (object) => {
			const text = textElementNodeSchema.safeParse(object);

			if (text.success) {
				const role = headingRoleByElement.get(text.data.props.element ?? "");

				if (role) {
					roles.set(normalizeCollectionPointer({ pointer: text.data.props.content.$text }), role);
				}
			}
		},
	});
	textElementRoles.set(definition, roles);

	return roles;
};

const textFieldRole = ({
	category,
	path,
	textElementRoles,
}: {
	category: string;
	path: string;
	textElementRoles: ReadonlyMap<string, WebsiteGenerationTextFieldRole>;
}): WebsiteGenerationTextFieldRole => {
	if (/(?:^|\/)alt(?:[-_/]|$)/iu.test(path)) {
		return "alt";
	}

	if (/(?:^|[-_/])(?:label|button|action|link)(?:$|[-_/])/iu.test(path)) {
		return "action-label";
	}

	if (/(?:^|[-_/])(?:kicker|eyebrow|overline)(?:$|[-_/])/iu.test(path)) {
		return "kicker";
	}

	if (category === "faq") {
		if (/(?:^|[-_/])(?:question|title|heading)(?:$|[-_/])/iu.test(path)) {
			return "faq-question";
		}

		if (/(?:^|[-_/])(?:answer|description|body|content)(?:$|[-_/])/iu.test(path)) {
			return "faq-answer";
		}
	}

	const semanticRole = textElementRoles.get(normalizeCollectionPointer({ pointer: path }));

	if (semanticRole) {
		return semanticRole;
	}

	if (/(?:^|[-_/])heading(?:$|[-_/])/iu.test(path)) {
		return "heading";
	}

	return "body";
};

const wordBudgetByRole = {
	"action-label": { maxWords: 5, minWords: 1 },
	alt: { maxWords: 15, minWords: 3 },
	body: { maxWords: 35, minWords: 6 },
	"faq-answer": { maxWords: 45, minWords: 8 },
	"faq-question": { maxWords: 14, minWords: 3 },
	heading: { maxWords: 8, minWords: 2 },
	"heading-1": { maxWords: 10, minWords: 3 },
	"heading-2": { maxWords: 9, minWords: 2 },
	kicker: { maxWords: 6, minWords: 1 },
} satisfies Record<WebsiteGenerationTextFieldRole, { maxWords: number; minWords: number }>;

export const createWebsitePromptFields = ({
	definition,
	overrides = definition.pattern === "cta-basic" ? websiteGenerationFieldOverrides[definition.pattern] : undefined,
	paths = listSectionContentPointers({ definition, kind: "text" }),
}: {
	definition: SectionDefinition;
	overrides?: Record<string, WebsiteGenerationTextFieldOverride>;
	paths?: Array<string>;
}) => {
	const textElementRoles = listTextElementRoles({ definition });

	return paths.map((path, index) => {
		const role = textFieldRole({ category: definition.category, path, textElementRoles });
		const override = overrides?.[path];
		const resolvedRole = override?.role ?? role;

		return { key: `f${index}`, path, role: resolvedRole, ...wordBudgetByRole[resolvedRole], ...override };
	});
};

const targetPageKeyForLink = ({
	index,
	navigation,
	pageKeys,
	slot,
}: {
	index: number;
	navigation: boolean;
	pageKeys: ReadonlyArray<string>;
	slot: GenerationSectionSlot;
}) => {
	if (slot.area !== "page") {
		return navigation ? (pageKeys[index % pageKeys.length] ?? "home") : "contact";
	}

	if (index === 0) {
		return slot.pageKey === "contact"
			? (pageKeys.find((key) => key === "services" || key === "menu") ?? "home")
			: "contact";
	}

	const secondaryByPage = {
		about: "services",
		contact: "home",
		faq: "services",
		home: "services",
		services: "about",
	} satisfies Record<(typeof generationPageKeys)[number], (typeof generationPageKeys)[number]>;

	const pageKey = generationPageKeys.find((candidate) => candidate === slot.pageKey);
	const target = pageKey ? secondaryByPage[pageKey] : "contact";

	return pageKeys.includes(target) ? target : "contact";
};

export const createWebsiteGenerationSlots = ({
	businessName,
	pageKeys = generationPageKeys,
	profileKeyword,
	slots,
	templateId,
	websiteId,
}: {
	businessName: string;
	pageKeys?: ReadonlyArray<string>;
	profileKeyword: string;
	slots: Array<GenerationSectionSlot>;
	templateId: string;
	websiteId: string;
}): Array<WebsiteSectionGenerationSlot> => {
	const stockIndexReference = { value: 0 };
	const headingOffset = generationSeedHash(`${websiteId}:headings`) % headingApproaches.length;

	return slots.map((slot, slotIndex) => {
		const { definition } = slot;
		const fields = createWebsitePromptFields({ definition });
		const fieldPaths = new Set(fields.map(({ path }) => path));
		const codeIndexReference = { value: 0 };
		const links = listWebsiteDefinitionLinks({ definition });
		const navigationLinks = links.filter(({ navigation }) => navigation);

		const linkIntents = links.map(({ navigation, path }, index) => ({
			path,
			targetPageKey: targetPageKeyForLink({
				index: navigation ? navigationLinks.findIndex((link) => link.path === path) : index,
				navigation,
				pageKeys,
				slot,
			}),
		}));

		const labelTargets = new Map(
			links.flatMap(({ labels }, index) =>
				labels.map((path) => [path, linkIntents[index]!.targetPageKey] as const)
			)
		);

		const codeFields = fields.flatMap<WebsiteGenerationCodeField>(({ path }) => {
			if (definition.pattern === "contact-form") {
				const key = Object.keys(contactFormContent.en).find((candidate) => `/copy/${candidate}` === path);
				const en = Object.entries(contactFormContent.en).find(([candidate]) => candidate === key)?.[1];
				const ar = Object.entries(contactFormContent.ar).find(([candidate]) => candidate === key)?.[1];

				if (en && ar) {
					return [{ ar, en, kind: "contact-copy", path }];
				}
			}

			const pageKey = labelTargets.get(path);

			if (pageKey) {
				return [{ kind: "navigation-label" as const, pageKey, path }];
			}

			const codeField = createWebsiteGenerationCodeField({
				businessName,
				category: definition.category,
				index: codeIndexReference.value + 1,
				path,
				paths: fieldPaths,
			});

			if (!codeField) {
				return [];
			}

			if (codeField.kind === "index") {
				codeIndexReference.value++;
			}

			return [codeField];
		});

		const codeFieldPaths = new Set(codeFields.map(({ path }) => path));
		const linkPointers = listSectionContentPointers({ definition, kind: "link" });

		return {
			assetIntents: listSectionContentPointers({ definition, kind: "asset" }).map((pointer) => {
				const stockRole = resolveWebsiteAssetStockRole({ area: slot.area, definition, pointer });

				const intentStockIndex = stockRole === null ? 0 : stockIndexReference.value++;

				return {
					assetId: entityIdFromSeed({ seed: `${websiteId}:${templateId}:${slot.slotKey}:asset:${pointer}` }),
					profileKeyword,
					searchable: stockRole !== null && intentStockIndex < MAX_STOCK_ASSETS,
					sectionCategory: definition.category,
					sectionPurpose: slot.purpose,
					slotKey: slot.slotKey,
					stockIndex: intentStockIndex,
					stockRole,
				};
			}),
			codeFields,
			fieldOrder: fields.map(({ path }) => path),
			linkIntents,
			linkPointers,
			promptSlot: {
				fields: fields.filter(({ path }) => !codeFieldPaths.has(path)),
				headingApproach: headingApproaches[(slotIndex + headingOffset) % headingApproaches.length],
				links: linkIntents,
				pageKey: slot.pageKey,
				pageOutline: slots
					.filter((other) => other.area === slot.area && other.pageKey === slot.pageKey)
					.map((other) => ({ purpose: other.purpose, slotKey: other.slotKey })),
				purpose: slot.purpose,
				sectionType: definition.category,
				slotKey: slot.slotKey,
			},
			slot: {
				area: slot.area,
				category: definition.category,
				index: slot.index,
				pageKey: slot.pageKey,
				pattern: definition.pattern,
				purpose: slot.purpose,
				required: slot.required,
				slotKey: slot.slotKey,
			},
		};
	}) satisfies Array<WebsiteSectionGenerationSlot>;
};
