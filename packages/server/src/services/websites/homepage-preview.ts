import {
	readWebsiteSectionLayoutContent,
	resolveLocalizedContent,
	stringValueSchema,
} from "@starter/infinite-website/editing";
import {
	createWebsiteHomepagePreviewDocument,
	generationPageKeys,
	listSiteDocumentAssetIds,
	upsertGeneratedSections,
	websiteGenerationLocales,
	type ResolvedAsset,
	type WebsiteAssetBindings,
	listWebsiteLocalizations,
	type Iso6391LanguageCode,
	type WebsiteBriefV1,
	type WebsiteGenerationPlan,
	type WebsiteLocalizations,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";
import { templatePreviews } from "@starter/infinite-website/template-previews";
import { log } from "@starter/observability";

import { createWebsiteBrandMarkAsset, selectReusableWebsiteImages, type WebsiteAssetIntent } from "./assets";
import {
	assembleWebsiteSections,
	materializeWebsiteSection,
	prepareWebsiteGeneration,
	settleWebsiteAssetIntents,
	type WebsiteGenerationPreparation,
} from "./generation";
import { generateWebsiteSection as runWebsiteSectionGeneration, websiteLanguageName } from "./generation-model";
import { websiteSectionLocalizationConcurrency, type WebsiteSectionGenerationSlot } from "./generation-slots";
import { saveWebsitePreviewFields, type WebsitePreviewScope } from "./preview-cache";

type PreviewFieldRole = WebsiteSectionGenerationSlot["promptSlot"]["fields"][number]["role"];

export const readWebsiteHomepagePreviewFields = ({
	generationSlot,
	locale,
	snapshot,
}: {
	generationSlot: WebsiteSectionGenerationSlot;
	locale: Iso6391LanguageCode;
	snapshot?: WebsiteSnapshotV1;
}) => {
	if (!snapshot) {
		return [];
	}

	const { slot } = generationSlot;
	const page = snapshot.document.structure.pages.find(({ home }) => home);
	const sections = slot.area === "page" ? page?.sections : snapshot.document.structure.layout[slot.area];
	const matches = sections?.filter(({ source }) => source?.pattern === slot.pattern);
	const uniqueMatch = matches?.length === 1 ? matches[0] : undefined;
	const section = sections?.[slot.index]?.source?.pattern === slot.pattern ? sections[slot.index] : uniqueMatch;

	if (!sections || !section || (slot.area === "page" && !page)) {
		return [];
	}

	const base = { index: sections.indexOf(section), sectionId: section.id };

	const target =
		slot.area === "page" && page
			? { ...base, area: "page" as const, pageId: page.id }
			: { ...base, area: slot.area === "header" ? ("header" as const) : ("footer" as const) };

	const source = readWebsiteSectionLayoutContent({ document: snapshot.document, target });
	const text = new Map(source?.locales[locale]?.text.map(({ pointer, value }) => [pointer, value]));

	return generationSlot.promptSlot.fields.flatMap(({ path }) => {
		const value = text.get(path);

		return value?.trim() ? [{ path, value }] : [];
	});
};

const createFieldFallback = ({
	brief,
	locale,
	role,
}: {
	brief: WebsiteBriefV1;
	locale: Iso6391LanguageCode;
	role: PreviewFieldRole;
}) => {
	const values: Record<PreviewFieldRole, string> =
		locale === "ar"
			? {
					"action-label": "اعرف المزيد",
					alt: `${brief.name}، نشاط ${brief.type} في ${brief.location}`,
					body: `اكتشف ما يقدمه ${brief.name} للعملاء الباحثين عن ${brief.type} في ${brief.location}.`,
					"faq-answer": `تواصل مع ${brief.name} لمناقشة احتياجاتك ومعرفة الخيارات المتاحة.`,
					"faq-question": "ما الذي يمكن للعملاء توقعه؟",
					heading: `${brief.name} — ${brief.type}`,
					"heading-1": `${brief.name} — ${brief.type}`,
					"heading-2": `${brief.name} — ${brief.type}`,
					kicker: brief.location,
				}
			: {
					"action-label": "Learn more",
					alt: `${brief.name}, a ${brief.type} business in ${brief.location}`,
					body: `Explore what ${brief.name} offers customers looking for ${brief.type} in ${brief.location}.`,
					"faq-answer": `Contact ${brief.name} to discuss what you need and learn what is available.`,
					"faq-question": "What can customers expect?",
					heading: `${brief.name} — ${brief.type}`,
					"heading-1": `${brief.name} — ${brief.type}`,
					"heading-2": `${brief.name} — ${brief.type}`,
					kicker: brief.location,
				};

	return values[role];
};

export const createWebsiteHomepagePreviewHeaderLocalizations = ({
	localizations,
}: {
	localizations: WebsiteLocalizations<{ language: string; plan: WebsiteGenerationPlan }>;
}) => ({
	byLocale: Object.fromEntries(
		listWebsiteLocalizations({ localizations }).map(({ locale, value }) => [
			locale,
			{
				fields: [],
				plan: value.plan,
			},
		])
	),
	defaultLocale: localizations.defaultLocale,
});

export const createWebsiteHomepagePreviewFallbackFields = ({
	brief,
	generationSlot,
	locale,
	templateId,
}: {
	brief: WebsiteBriefV1;
	generationSlot: WebsiteSectionGenerationSlot;
	locale: Iso6391LanguageCode;
	templateId: string;
}) => {
	const preview = templatePreviews.find(({ id }) => id === templateId);

	const section = preview
		? [
				...preview.document.structure.layout.header,
				...preview.document.structure.pages.flatMap(({ sections }) => sections),
				...preview.document.structure.layout.footer,
			].find(({ source }) => source?.pattern === generationSlot.slot.pattern)
		: undefined;

	return generationSlot.promptSlot.fields.map(({ path, role }) => {
		if (preview && section) {
			try {
				const value = stringValueSchema.safeParse(
					resolveLocalizedContent({
						area: "sections",
						content: preview.document.content,
						defaultLocale: preview.document.defaultLocale,
						id: section.contentId,
						locale,
						pointer: path,
					})
				);

				if (value.success && value.data.trim()) {
					return { path, value: value.data.trim() };
				}
			} catch {}
		}

		return { path, value: createFieldFallback({ brief, locale, role }) };
	});
};

const previewPageTitles = {
	ar: { about: "من نحن", contact: "تواصل معنا", faq: "الأسئلة الشائعة", home: "الرئيسية", services: "خدماتنا" },
	en: { about: "About", contact: "Contact", faq: "FAQ", home: "Home", services: "Services" },
} as const;

const prepareWebsiteHomepagePreview = ({
	brief,
	templateId,
	websiteId,
}: {
	brief: WebsiteBriefV1;
	templateId: string;
	websiteId: string;
}) => {
	const preparation = prepareWebsiteGeneration({
		brief,
		plans: websiteGenerationLocales.map((locale) => ({
			language: websiteLanguageName(locale),
			locale,
			plan: {
				kind: "plan",
				pages: generationPageKeys.map((pageKey) => ({
					description: `${previewPageTitles[locale][pageKey]} — ${brief.name}, ${brief.type}, ${brief.location}`,
					pageKey,
					title: previewPageTitles[locale][pageKey],
				})),
				siteDescription:
					locale === "ar"
						? `${brief.name} هو نشاط ${brief.type} في ${brief.location}.`
						: `${brief.name} is a ${brief.type} business in ${brief.location}.`,
			},
			status: "valid",
		})),
		templateId,
		websiteId,
	});

	const headerSections = preparation.generationSlots
		.filter(({ slot }) => slot.area === "header")
		.map((generationSlot) =>
			materializeWebsiteSection({
				generatedSection: generationSlot,
				localizations: createWebsiteHomepagePreviewHeaderLocalizations({
					localizations: preparation.localizations,
				}),
				pages: preparation.snapshot.document.structure.pages,
				templateId,
				websiteId,
			})
		);

	const preparedPreview = {
		...preparation,
		snapshot: {
			...preparation.snapshot,
			document: upsertGeneratedSections({
				document: preparation.snapshot.document,
				sections: headerSections,
			}),
		},
	};

	return {
		generationSlots: preparedPreview.generationSlots.filter(
			({ slot }) => slot.area !== "header" && (slot.area !== "page" || slot.pageKey === "home")
		),
		preparation: preparedPreview,
	};
};

type WebsiteHomepagePreviewInput = {
	abortSignal?: AbortSignal;
	brief: WebsiteBriefV1;
	existingAssets: Array<ResolvedAsset>;
	locale?: Iso6391LanguageCode;
	previewScope?: WebsitePreviewScope;
	snapshot?: WebsiteSnapshotV1;
	templateId: string;
	websiteId: string;
};

export const createWebsitePreviewAssetBindings = ({
	brandColors,
	brief,
	existingAssets,
	intents,
}: {
	brandColors: { background: string; primary: string };
	brief: WebsiteBriefV1;
	existingAssets: Array<ResolvedAsset>;
	intents: Array<WebsiteAssetIntent>;
}) => {
	const images = selectReusableWebsiteImages({ assets: existingAssets });

	if (images.length === 0) {
		return null;
	}

	const brandMark = createWebsiteBrandMarkAsset({ brandColors, businessName: brief.name });

	return Object.fromEntries(
		intents.map((intent) => {
			const image = images[intent.stockIndex % images.length];

			return [
				intent.assetId,
				intent.stockRole === null || !image
					? brandMark
					: {
							...image,
							loading: intent.stockRole === "hero-background" ? ("eager" as const) : ("lazy" as const),
						},
			];
		})
	) satisfies WebsiteAssetBindings;
};

const limitWebsiteSnapshotToHomepage = ({ snapshot }: { snapshot: WebsiteSnapshotV1 }) => {
	const document = createWebsiteHomepagePreviewDocument({ document: snapshot.document });
	const assetIds = new Set(listSiteDocumentAssetIds({ document }));

	return {
		...snapshot,
		assets: Object.fromEntries(Object.entries(snapshot.assets).filter(([assetId]) => assetIds.has(assetId))),
		document,
	};
};

export const createWebsiteHomepagePreviewSkeleton = ({
	brief,
	existingAssets,
	templateId,
	websiteId,
}: WebsiteHomepagePreviewInput) => {
	const { generationSlots, preparation } = prepareWebsiteHomepagePreview({ brief, templateId, websiteId });

	const assetBindings = createWebsitePreviewAssetBindings({
		brandColors: preparation.snapshot.brand.colors,
		brief,
		existingAssets,
		intents: generationSlots.flatMap(({ assetIntents }) => assetIntents),
	});

	return limitWebsiteSnapshotToHomepage({
		snapshot: {
			...preparation.snapshot,
			assets: { ...preparation.snapshot.assets, ...assetBindings },
		},
	});
};

const generateWebsiteHomepageSection = async ({
	abortSignal,
	brief,
	generationSlot,
	locale: selectedLocale,
	metrics,
	preparation,
	previewScope,
	scheduleLocalization,
	snapshot,
	templateId,
	websiteId,
}: {
	abortSignal?: AbortSignal;
	brief: WebsiteBriefV1;
	generationSlot: WebsiteSectionGenerationSlot;
	locale: Iso6391LanguageCode;
	metrics: {
		fallbackLocalizations: number;
		generatedLocalizations: number;
		repairs: number;
		reusedFields: number;
		reusedLocalizations: number;
	};
	preparation: WebsiteGenerationPreparation;
	previewScope?: WebsitePreviewScope;
	scheduleLocalization: <Result>(operation: () => Promise<Result>) => Promise<Result>;
	snapshot?: WebsiteSnapshotV1;
	templateId: string;
	websiteId: string;
}) => {
	const generatedLocalizations = await Promise.all(
		websiteGenerationLocales.map(async (locale) => {
			abortSignal?.throwIfAborted();
			const localization = preparation.localizations.byLocale[locale];

			if (!localization) {
				throw new Error(`Website homepage preview is missing localization "${locale}"`);
			}

			const reusedFields = readWebsiteHomepagePreviewFields({ generationSlot, locale, snapshot });
			const existing = new Map(reusedFields.map(({ path, value }) => [path, value]));
			const missingFields = generationSlot.promptSlot.fields.filter(({ path }) => !existing.has(path));

			if (locale === selectedLocale) {
				metrics.reusedFields += reusedFields.length;
			}

			const fallbackFields = createWebsiteHomepagePreviewFallbackFields({
				brief,
				generationSlot,
				locale,
				templateId,
			}).map((field) => ({ ...field, value: existing.get(field.path) ?? field.value }));

			if (locale !== selectedLocale || missingFields.length === 0) {
				if (locale === selectedLocale) {
					metrics.reusedLocalizations += 1;
				}

				if (locale === selectedLocale && previewScope && missingFields.length === 0) {
					await saveWebsitePreviewFields({
						fields: reusedFields,
						scope: previewScope,
						target: JSON.stringify([templateId, generationSlot.slot.slotKey, locale]),
					});
				}

				return [locale, { fields: fallbackFields, plan: localization.plan }] as const;
			}

			return scheduleLocalization(async () => {
				abortSignal?.throwIfAborted();

				const missingSlot = {
					...generationSlot,
					promptSlot: { ...generationSlot.promptSlot, fields: missingFields },
				};

				try {
					metrics.generatedLocalizations += 1;

					const request = {
						abortSignal,
						brief,
						generationSlot: missingSlot,
						language: localization.language,
						locale,
						plan: localization.plan,
						templateName: preparation.templateName,
					};

					const firstAttempt = await runWebsiteSectionGeneration(request);

					if (firstAttempt.status === "repair") {
						metrics.repairs += 1;
					}

					const generated =
						firstAttempt.status === "repair"
							? await runWebsiteSectionGeneration({ ...request, repair: firstAttempt })
							: firstAttempt;

					abortSignal?.throwIfAborted();

					const fields =
						generated.status === "valid" ? [...reusedFields, ...generated.fields] : fallbackFields;

					if (generated.status !== "valid") {
						metrics.fallbackLocalizations += 1;
					}

					if (generated.status === "valid" && previewScope) {
						await saveWebsitePreviewFields({
							fields,
							scope: previewScope,
							target: JSON.stringify([templateId, generationSlot.slot.slotKey, locale]),
						});
					}

					return [
						locale,
						{
							fields,
							plan: localization.plan,
						},
					] as const;
				} catch {
					abortSignal?.throwIfAborted();
					metrics.fallbackLocalizations += 1;

					return [locale, { fields: fallbackFields, plan: localization.plan }] as const;
				}
			});
		})
	);

	return materializeWebsiteSection({
		generatedSection: generationSlot,
		localizations: {
			byLocale: Object.fromEntries(generatedLocalizations),
			defaultLocale: preparation.localizations.defaultLocale,
		},
		pages: preparation.snapshot.document.structure.pages,
		templateId,
		websiteId,
	});
};

const createWebsiteHomepagePreviewLocalizationQueue = () => {
	const state = { active: 0 };
	const waiting: Array<() => void> = [];

	return async <Result>(operation: () => Promise<Result>) => {
		if (state.active >= websiteSectionLocalizationConcurrency) {
			await new Promise<void>((resolve) => {
				waiting.push(() => {
					state.active += 1;
					resolve();
				});
			});
		} else {
			state.active += 1;
		}

		try {
			return await operation();
		} finally {
			state.active -= 1;
			waiting.shift()?.();
		}
	};
};

export const generateWebsiteHomepagePreview = async ({
	abortSignal,
	brief,
	existingAssets,
	locale = "en",
	previewScope,
	snapshot,
	templateId,
	websiteId,
}: WebsiteHomepagePreviewInput) => {
	abortSignal?.throwIfAborted();

	const { generationSlots, preparation } = prepareWebsiteHomepagePreview({
		brief,
		templateId,
		websiteId,
	});

	const intents = generationSlots.flatMap(({ assetIntents }) => assetIntents);

	const reusedAssetBindings = createWebsitePreviewAssetBindings({
		brandColors: preparation.snapshot.brand.colors,
		brief,
		existingAssets,
		intents,
	});

	const assetBindingsResult = reusedAssetBindings
		? Promise.resolve({ assetBindings: reusedAssetBindings })
		: settleWebsiteAssetIntents({
				abortSignal,
				brandColors: preparation.snapshot.brand.colors,
				brief,
				intents,
			});

	const scheduleLocalization = createWebsiteHomepagePreviewLocalizationQueue();
	const startedAt = Date.now();

	const metrics = {
		fallbackLocalizations: 0,
		generatedLocalizations: 0,
		repairs: 0,
		reusedFields: 0,
		reusedLocalizations: 0,
	};

	const [sections, { assetBindings }] = await Promise.all([
		Promise.all(
			generationSlots.map((generationSlot) =>
				generateWebsiteHomepageSection({
					abortSignal,
					brief,
					generationSlot,
					locale,
					metrics,
					preparation,
					previewScope,
					scheduleLocalization,
					snapshot,
					templateId,
					websiteId,
				})
			)
		),
		assetBindingsResult,
	]);

	log.info({
		...metrics,
		locale,
		message: "Website homepage preview settled",
		previewLatencyMs: Date.now() - startedAt,
		templateId,
		websiteId,
	});

	const assembled = assembleWebsiteSections({
		assetBindings,
		preparation,
		sections,
	});

	return limitWebsiteSnapshotToHomepage({
		snapshot: { ...assembled.snapshot, assets: { ...assembled.snapshot.assets, ...assembled.assetBindings } },
	});
};
