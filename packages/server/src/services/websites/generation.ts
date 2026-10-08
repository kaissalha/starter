import type { BrandFoundationV1 } from "@starter/infinite-brand";
import { templateCatalog } from "@starter/infinite-website/catalog";
import { getWebsiteSectionLayoutDefinition } from "@starter/infinite-website/editing";
import {
	resolveWebsiteGenerationProfile,
	createSectionTextContentFromFields,
	createGenerationTemplateBrand,
	createWebsiteSectionPreviewDocument,
	createWebsiteGenerationShell,
	entityIdFromSeed,
	instantiateSection,
	listSiteDocumentAssetIds,
	listWebsiteLocalizations,
	listGenerationSlots,
	materializeSectionContent,
	pendingTextContent,
	readDefaultWebsiteLocalization,
	removeGeneratedSection,
	upsertGeneratedSections,
	websiteGenerationProfiles,
	websiteGenerationLocales,
	websiteGenerationSectionDefinitions,
	type Iso6391LanguageCode,
	type ResolvedAsset,
	type SectionTextField,
	type WebsiteBriefV1,
	type WebsiteAssetBindings,
	type WebsiteGenerationPlan,
	type WebsiteLocalizations,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";
import { templatePreviews } from "@starter/infinite-website/template-previews";

import {
	createWebsiteBrandMarkAsset,
	resolveWebsiteAssets,
	WEBSITE_PLACEHOLDER_ASSET,
	type WebsiteAssetIntent,
} from "./assets";
import { websiteLanguageName, type generateWebsitePlan } from "./generation-model";
import {
	createWebsiteGenerationSlots,
	resolveWebsiteGenerationFields,
	type WebsiteSectionGenerationSlot,
} from "./generation-slots";

export {
	generateWebsitePlan,
	generateWebsiteSection,
	selectWebsiteGenerationBrand,
	selectWebsiteGenerationTemplate,
} from "./generation-model";

export {
	createWebsiteGenerationSlots,
	createWebsitePromptFields,
	resolveWebsiteGenerationFields,
} from "./generation-slots";

export type { WebsiteSectionGenerationSlot } from "./generation-slots";

export { websiteSectionLocalizationConcurrency } from "./generation-slots";

export { websiteGenerationLocales };

export const listWebsiteTemplateThemes = ({ locale }: { locale: Iso6391LanguageCode }) => {
	const profiles = new Map(websiteGenerationProfiles.map((profile) => [profile.templateId, profile]));
	const previews = new Map(templatePreviews.map((preview) => [preview.id, preview]));

	return templateCatalog.flatMap(({ description, id, name, tags }) => {
		const profile = profiles.get(id);
		const preview = previews.get(id);

		if (!profile || !preview) {
			return [];
		}

		const page = preview.document.structure.pages.find(({ home }) => home);
		const section = page?.sections.find(({ category }) => category === "hero") ?? page?.sections[0];

		if (!page || !section) {
			throw new Error(`Template preview "${id}" is missing a homepage section`);
		}

		const document = createWebsiteSectionPreviewDocument({
			document: preview.document,
			section,
			target: { area: "page", index: 0, pageId: page.id, sectionId: section.id },
		});

		const assetIds = new Set(listSiteDocumentAssetIds({ document }));

		return [
			{
				description,
				id,
				name,
				preview: {
					assets: Object.fromEntries(
						Object.entries(preview.assets).filter(([assetId]) => assetIds.has(assetId))
					),
					brand: createGenerationTemplateBrand({ locale, profile }),
					document,
					schemaVersion: 1 as const,
					templateId: id,
				},
				tags,
			},
		];
	});
};

export const settleWebsiteAssetIntents = async ({
	abortSignal,
	brandColors,
	brief,
	fallbackAssets,
	intents,
}: {
	abortSignal?: AbortSignal;
	brandColors: { background: string; primary: string };
	brief: WebsiteBriefV1;
	fallbackAssets?: Array<ResolvedAsset>;
	intents: Array<WebsiteAssetIntent>;
}) => {
	const assetBindings = await resolveWebsiteAssets({
		abortSignal,
		brandColors,
		businessName: brief.name,
		businessType: brief.type,
		fallbackAssets,
		intents,
	});

	return {
		assetBindings,
		assets: intents.flatMap((intent) => {
			const asset = assetBindings[intent.assetId];

			return intent.searchable && asset
				? [
						{
							asset,
							assetId: intent.assetId,
							outcome:
								asset.src === WEBSITE_PLACEHOLDER_ASSET.src
									? ("placeholder" as const)
									: ("provider" as const),
							slotKey: intent.slotKey,
						},
					]
				: [];
		}),
	};
};

export const listWebsiteSnapshotLocalizations = ({
	brief,
	snapshot,
}: {
	brief: WebsiteBriefV1;
	snapshot: WebsiteSnapshotV1;
}) =>
	snapshot.document.locales.map((locale) => {
		const localized = snapshot.document.content[locale];

		if (!localized) {
			throw new Error(`Website snapshot is missing generation context for "${locale}"`);
		}

		const plan: WebsiteGenerationPlan = {
			kind: "plan",
			pages: snapshot.document.structure.pages.map((documentPage) => {
				const content = localized.pages[documentPage.id];

				if (!content?.route?.slug || !content.seo?.title) {
					throw new Error(`Website page "${documentPage.id}" is missing generation context for "${locale}"`);
				}

				return {
					description: content.seo.description ?? content.seo.title,
					pageKey: content.route.slug,
					title: content.seo.title,
				};
			}),
			siteDescription: localized.site.description ?? localized.site.name ?? brief.name,
		};

		return { language: websiteLanguageName(locale), locale, localized, plan };
	});

const prepareWebsiteGenerationSlots = ({
	brief,
	templateId,
	websiteId,
}: {
	brief: WebsiteBriefV1;
	templateId: string;
	websiteId: string;
}) => {
	const profile = resolveWebsiteGenerationProfile({ brief, templateId });

	const generationSlots = createWebsiteGenerationSlots({
		businessName: brief.name,
		pageKeys: Object.keys(profile.pages),
		profileKeyword: profile.keywords[0] ?? "business",
		slots: listGenerationSlots({ profile }),
		templateId: profile.templateId,
		websiteId,
	});

	return { generationSlots, profile };
};

export const prepareWebsiteGeneration = ({
	brand,
	brief,
	plans,
	templateId,
	websiteId,
}: {
	brand?: BrandFoundationV1 | null;
	brief: WebsiteBriefV1;
	plans: Array<Extract<Awaited<ReturnType<typeof generateWebsitePlan>>, { status: "valid" }>>;
	templateId: string;
	websiteId: string;
}) => {
	const { generationSlots, profile } = prepareWebsiteGenerationSlots({ brief, templateId, websiteId });

	const localizationEntries = plans.map(({ language, locale, plan }) => [locale, { language, plan }] as const);

	const localizations: WebsiteLocalizations<{ language: string; plan: WebsiteGenerationPlan }> = {
		byLocale: Object.fromEntries(localizationEntries),
		defaultLocale: "en",
	};

	const plansByLocale = Object.fromEntries(localizationEntries.map(([locale, value]) => [locale, value.plan]));

	const shell = createWebsiteGenerationShell({
		brand,
		brief,
		localizations: { byLocale: plansByLocale, defaultLocale: localizations.defaultLocale },
		profile,
		websiteId,
	});

	const brandMark = createWebsiteBrandMarkAsset({ brandColors: shell.brand.colors, businessName: brief.name });

	const shellWithAssets = {
		...shell,
		assets: Object.fromEntries(
			generationSlots
				.flatMap(({ assetIntents }) => assetIntents)
				.map((intent) => [intent.assetId, intent.stockRole === null ? brandMark : WEBSITE_PLACEHOLDER_ASSET])
		),
	};

	const placeholderSections = generationSlots.map((generationSlot) =>
		materializeWebsiteSection({
			generatedSection: generationSlot,
			localizations: {
				byLocale: Object.fromEntries(
					listWebsiteLocalizations({ localizations }).map(({ locale: contentLocale, value }) => [
						contentLocale,
						{
							fields: generationSlot.promptSlot.fields.map(({ path }) => ({
								path,
								value: pendingTextContent,
							})),
							plan: value.plan,
						},
					])
				),
				defaultLocale: localizations.defaultLocale,
			},
			pages: shell.document.structure.pages,
			templateId: profile.templateId,
			websiteId,
		})
	);

	const snapshot = {
		...shellWithAssets,
		document: upsertGeneratedSections({
			document: shellWithAssets.document,
			sections: placeholderSections,
		}),
	};

	const slots = placeholderSections.map(({ assetIds, section, slotKey, target }) => ({
		assetIds,
		sectionId: section.id,
		slotKey,
		target,
	}));

	return {
		generationSlots,
		localizations,
		slots,
		snapshot,
		templateId: profile.templateId,
		templateName: profile.name,
	};
};

export type WebsiteGenerationPreparation = Awaited<ReturnType<typeof prepareWebsiteGeneration>> & {
	previewFields?: Record<string, Array<SectionTextField>>;
};

export const resolveWebsiteGenerationMedia = async ({
	brand,
	brief,
	templateId,
	websiteId,
}: {
	brand?: BrandFoundationV1 | null;
	brief: WebsiteBriefV1;
	templateId: string;
	websiteId: string;
}) => {
	const { generationSlots, profile } = prepareWebsiteGenerationSlots({ brief, templateId, websiteId });

	return settleWebsiteAssetIntents({
		brandColors: (brand ?? createGenerationTemplateBrand({ locale: "en", profile })).colors,
		brief,
		intents: generationSlots.flatMap(({ assetIntents }) => assetIntents),
	});
};

export const materializeWebsiteSection = ({
	generatedSection,
	localizations,
	pages,
	templateId,
	websiteId,
}: {
	generatedSection: WebsiteSectionGenerationSlot;
	localizations: WebsiteLocalizations<{ fields: Array<SectionTextField>; plan: WebsiteGenerationPlan }>;
	pages: WebsiteSnapshotV1["document"]["structure"]["pages"];
	templateId: string;
	websiteId: string;
}) => {
	const { linkIntents, linkPointers } = generatedSection;

	const definition =
		generatedSection.slot.area === "page"
			? websiteGenerationSectionDefinitions.find(({ pattern }) => pattern === generatedSection.slot.pattern)
			: getWebsiteSectionLayoutDefinition({ pattern: generatedSection.slot.pattern });

	if (!definition || definition.category !== generatedSection.slot.category) {
		throw new Error(
			`Website generation pattern "${generatedSection.slot.pattern}" is not available for "${templateId}"`
		);
	}

	const slot = { ...generatedSection.slot, definition };
	const defaultLocalization = readDefaultWebsiteLocalization({ localizations });

	const pageTarget =
		slot.area === "page" && slot.pageKey
			? pages[defaultLocalization.plan.pages.findIndex(({ pageKey }) => pageKey === slot.pageKey)]
			: undefined;

	const materializedLocalizations = listWebsiteLocalizations({ localizations }).map(
		({ locale: contentLocale, value: { fields } }) => ({
			locale: contentLocale,
			materialized: materializeSectionContent({
				createAssetId: ({ pointer }) =>
					entityIdFromSeed({ seed: `${websiteId}:${templateId}:${slot.slotKey}:asset:${pointer}` }),
				createLink: ({ pointer }) => {
					const pointerIndex = linkPointers.indexOf(pointer);

					if (pointerIndex === -1) {
						throw new Error(`Website generation could not bind link "${pointer}"`);
					}

					const targetPageKey = linkIntents[pointerIndex]?.targetPageKey;

					const targetIndex = defaultLocalization.plan.pages.findIndex(
						({ pageKey }) => pageKey === targetPageKey
					);

					const target = targetIndex >= 0 ? pages[targetIndex] : pages[pointerIndex % pages.length];

					if (!target) {
						throw new Error(`Website generation could not bind link "${pointer}"`);
					}

					return { kind: "page", pageId: target.id };
				},
				definition: slot.definition,
				text: createSectionTextContentFromFields({
					definition: slot.definition,
					fields: resolveWebsiteGenerationFields({
						fields,
						generationSlot: generatedSection,
						locale: contentLocale,
					}),
				}),
			}),
		})
	);

	const materialized = materializedLocalizations.find(
		({ locale: contentLocale }) => contentLocale === localizations.defaultLocale
	)?.materialized;

	if (!materialized) {
		throw new Error(`Website section generation is missing the default locale "${localizations.defaultLocale}"`);
	}

	const expectedAssetIds = generatedSection.assetIntents.map(({ assetId }) => assetId);

	if (
		materialized.assetIds.length !== expectedAssetIds.length ||
		materialized.assetIds.some(({ assetId }, index) => assetId !== expectedAssetIds[index])
	) {
		throw new Error(`Website generation materialized unexpected assets for "${slot.slotKey}"`);
	}

	const instance = instantiateSection({
		anchor: slot.slotKey.split(".").join("-"),
		content: Object.fromEntries(
			materializedLocalizations.map(({ locale: contentLocale, materialized: localized }) => [
				contentLocale,
				localized.content,
			])
		),
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `${websiteId}:${templateId}:${kind}:${path}` }),
		defaultLocale: localizations.defaultLocale,
		definition: slot.definition,
		path: `/websites/${websiteId}/${slot.slotKey}`,
	});

	const target = (() => {
		if (slot.area === "header" || slot.area === "footer") {
			return { area: slot.area, index: slot.index };
		}

		if (pageTarget) {
			return { area: "page" as const, index: slot.index, pageId: pageTarget.id };
		}

		return null;
	})();

	if (!target) {
		throw new Error(`Generated section targets missing page "${slot.pageKey}"`);
	}

	return {
		assetIds: generatedSection.assetIntents.flatMap(({ assetId, searchable }) => (searchable ? [assetId] : [])),
		assetIntents: generatedSection.assetIntents,
		content: instance.content,
		section: instance.section,
		slotKey: slot.slotKey,
		target,
	};
};

export type MaterializedWebsiteSection = ReturnType<typeof materializeWebsiteSection>;

export const assembleWebsiteSections = ({
	assetBindings,
	preparation,
	sections,
	skippedSectionIds = [],
}: {
	assetBindings: WebsiteAssetBindings;
	preparation: WebsiteGenerationPreparation;
	sections: Array<MaterializedWebsiteSection>;
	skippedSectionIds?: Array<string>;
}) => {
	const preparedDocument = skippedSectionIds.reduce(
		(document, sectionId) => removeGeneratedSection({ document, sectionId }),
		preparation.snapshot.document
	);

	const snapshot = {
		...preparation.snapshot,
		document: upsertGeneratedSections({
			document: preparedDocument,
			sections,
		}),
	};

	return {
		assetBindings,
		snapshot,
	};
};
