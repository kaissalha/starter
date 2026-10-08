import type { LanguageModel } from "ai";

import {
	contactFormContent,
	listWebsiteLocalizations,
	pendingTextContent,
	readDefaultWebsiteLocalization,
	upsertGeneratedSection,
	resolveWebsiteGenerationProfile,
	websiteSnapshotSchema,
	type GenerationSectionSlot,
	type Iso6391LanguageCode,
	type WebsiteAssetBindings,
	type WebsiteBriefV1,
	type WebsiteGenerationPlan,
	type WebsiteGenerationSlotV1,
	type WebsiteLocalizations,
	type WebsiteSectionAdditionInputV1,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";

import { createWebsiteSectionAdditionPrompt, createWebsiteSectionOutputSchema } from "../../ai/prompts";
import { listSectionTexts } from "../../ai/website-texts";
import { models } from "../../mastra/models";
import { createWebsiteBrandMarkAsset, WEBSITE_PLACEHOLDER_ASSET } from "./assets";
import {
	createWebsiteGenerationSlots,
	listWebsiteSnapshotLocalizations,
	materializeWebsiteSection,
	type MaterializedWebsiteSection,
} from "./generation";
import { runWebsiteObjectGeneration, type WebsiteGenerationRepair } from "./generation-model";
import {
	websiteSectionCapabilities,
	websiteSectionPreviewCopy,
	WebsiteSectionAdditionInputError,
} from "./section-catalog";

export const createWebsiteSectionCatalogPreview = ({
	brief,
	pageId,
	pattern,
	snapshot,
	websiteId,
}: {
	brief: WebsiteBriefV1;
	pageId: string;
	pattern: string;
	snapshot: WebsiteSnapshotV1;
	websiteId: string;
}) => {
	const preparation = prepareWebsiteSectionAddition({
		brief,
		input: { index: 0, pageId, pattern, schemaVersion: 1 },
		snapshot,
		websiteId,
		workflowRunId: `catalog-preview-${pattern}`,
	});

	const materialized = materializeWebsiteSection({
		generatedSection: preparation.generationSlot,
		localizations: {
			byLocale: Object.fromEntries(
				listWebsiteLocalizations({ localizations: preparation.localizations }).map(({ locale, value }) => [
					locale,
					{
						fields: preparation.generationSlot.promptSlot.fields.map(({ path, role }) => ({
							path,
							value:
								(pattern === "contact-form"
									? Object.entries(contactFormContent[locale === "ar" ? "ar" : "en"]).find(
											([key]) => path === `/copy/${key}`
										)?.[1]
									: undefined) ?? websiteSectionPreviewCopy[locale === "ar" ? "ar" : "en"][role],
						})),
						plan: value.plan,
					},
				])
			),
			defaultLocale: preparation.localizations.defaultLocale,
		},
		pages: preparation.snapshot.document.structure.pages,
		templateId: preparation.templateId,
		websiteId,
	});

	const assets = {
		...preparation.snapshot.assets,
		...createWebsitePreviewAssetBindings({
			brandColors: preparation.snapshot.brand.colors,
			brief,
			existingAssets: Object.values(snapshot.assets),
			intents: preparation.generationSlot.assetIntents,
		}),
	};

	return {
		assets: Object.fromEntries(
			materialized.assetIds.map((assetId) => [assetId, assets[assetId] ?? WEBSITE_PLACEHOLDER_ASSET])
		),
		document: upsertGeneratedSection({
			document: preparation.snapshot.document,
			section: materialized,
		}),
	};
};

export const prepareWebsiteSectionAddition = ({
	brief,
	input,
	snapshot,
	websiteId,
	workflowRunId,
}: {
	brief: WebsiteBriefV1;
	input: WebsiteSectionAdditionInputV1;
	snapshot: WebsiteSnapshotV1;
	websiteId: string;
	workflowRunId: string;
}) => {
	const profile = resolveWebsiteGenerationProfile({ brief, templateId: snapshot.templateId });

	const page = snapshot.document.structure.pages.find(({ id }) => id === input.pageId);

	if (!page || input.index > page.sections.length) {
		throw new WebsiteSectionAdditionInputError("Website section insertion target is invalid");
	}

	const definition = websiteSectionCapabilities.find(({ pattern }) => pattern === input.pattern)?.definition;

	if (!definition) {
		throw new WebsiteSectionAdditionInputError(`Pattern "${input.pattern}" is not safe for website generation`);
	}

	const localizationEntries = listWebsiteSnapshotLocalizations({ brief, snapshot }).map(
		({ language, locale, localized, plan }) => {
			const pageContent = localized.pages[page.id];
			const pageKey = pageContent?.route?.slug;

			if (!pageKey || !pageContent.seo?.title) {
				throw new Error(`Website section insertion page is missing generation context for "${locale}"`);
			}

			return [
				locale,
				{
					language,
					page: {
						description: pageContent.seo.description ?? plan.siteDescription,
						title: pageContent.seo.title,
					},
					pageKey,
					plan,
				},
			] as const;
		}
	);

	const localizations: WebsiteLocalizations<{
		language: string;
		page: { description: string; title: string };
		pageKey: string;
		plan: WebsiteGenerationPlan;
	}> = {
		byLocale: Object.fromEntries(localizationEntries),
		defaultLocale: snapshot.document.defaultLocale,
	};

	const defaultLocalization = readDefaultWebsiteLocalization({ localizations });

	const slot: GenerationSectionSlot = {
		area: "page",
		definition,
		index: input.index,
		pageKey: defaultLocalization.pageKey,
		purpose: `Add a useful ${definition.category} section that complements the existing page.`,
		required: true,
		slotKey: `section-additions.${workflowRunId}`,
	};

	const generationSlot = createWebsiteGenerationSlots({
		businessName: brief.name,
		pageKeys: defaultLocalization.plan.pages.map(({ pageKey }) => pageKey),
		profileKeyword: profile.keywords[0] ?? "business",
		slots: [slot],
		templateId: profile.templateId,
		websiteId,
	})[0];

	if (!generationSlot) {
		throw new Error("Website section generation slot could not be created");
	}

	const materialized = materializeWebsiteSection({
		generatedSection: generationSlot,
		localizations: {
			byLocale: Object.fromEntries(
				listWebsiteLocalizations({ localizations }).map(({ locale, value }) => [
					locale,
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
		pages: snapshot.document.structure.pages,
		templateId: profile.templateId,
		websiteId,
	});

	return {
		generationSlot,
		localizations,
		slot: {
			assetIds: materialized.assetIds,
			sectionId: materialized.section.id,
			slotKey: materialized.slotKey,
			target: materialized.target,
		} satisfies WebsiteGenerationSlotV1,
		snapshot: websiteSnapshotSchema.parse({
			...snapshot,
			assets: {
				...snapshot.assets,
				...Object.fromEntries(
					generationSlot.assetIntents.map((intent) => [
						intent.assetId,
						intent.stockRole === null
							? createWebsiteBrandMarkAsset({
									brandColors: snapshot.brand.colors,
									businessName: brief.name,
								})
							: WEBSITE_PLACEHOLDER_ASSET,
					])
				),
			},
			document: upsertGeneratedSection({
				document: snapshot.document,
				section: materialized,
			}),
		}),
		templateId: profile.templateId,
		templateName: profile.name,
	};
};

export type WebsiteSectionAdditionPreparation = ReturnType<typeof prepareWebsiteSectionAddition>;

export const generateWebsiteSectionAddition = async ({
	brief,
	locale,
	model = models.websiteGeneration.model,
	preparation,
	repair,
}: {
	brief: WebsiteBriefV1;
	locale: Iso6391LanguageCode;
	model?: LanguageModel;
	preparation: WebsiteSectionAdditionPreparation;
	repair?: WebsiteGenerationRepair;
}) => {
	const value = preparation.localizations.byLocale[locale];

	if (!value) {
		throw new Error(`Website section addition is missing localization "${locale}"`);
	}

	if (preparation.generationSlot.slot.pattern === "contact-form") {
		return {
			fields: Object.entries(contactFormContent[locale === "ar" ? "ar" : "en"]).map(([key, text]) => ({
				path: `/copy/${key}`,
				value: text,
			})),
			locale,
			plan: value.plan,
			status: "valid" as const,
		};
	}

	const generated = await runWebsiteObjectGeneration({
		model,
		prompt: createWebsiteSectionAdditionPrompt({
			brief,
			category: preparation.generationSlot.slot.category,
			language: value.language,
			page: value.page,
			pattern: preparation.generationSlot.slot.pattern,
			slot: {
				...preparation.generationSlot.promptSlot,
				pageOutline: preparation.snapshot.document.structure.pages
					.find(({ id }) => preparation.slot.target.area === "page" && id === preparation.slot.target.pageId)
					?.sections.slice(Math.max(0, preparation.slot.target.index - 3), preparation.slot.target.index + 4)
					.map((section) => ({
						purpose:
							section.id === preparation.slot.sectionId
								? preparation.generationSlot.slot.purpose
								: listSectionTexts({ document: preparation.snapshot.document, locale, section })
										.slice(0, 8)
										.map(({ value }) => value)
										.join(" ")
										.slice(0, 1200),
						slotKey:
							section.id === preparation.slot.sectionId
								? preparation.generationSlot.slot.slotKey
								: section.id,
					})),
			},
			templateName: preparation.templateName,
		}),
		repair,
		schema: createWebsiteSectionOutputSchema({ slot: preparation.generationSlot.promptSlot }),
		telemetryFunctionId: "website-section-addition",
	});

	if (generated.status !== "valid") {
		return { locale, plan: value.plan, ...generated };
	}

	return { fields: generated.output.fields, locale, plan: value.plan, status: "valid" as const };
};

export const assembleWebsiteSectionAddition = ({
	assetBindings,
	existingAssetBindings,
	preparation,
	section,
}: {
	assetBindings: WebsiteAssetBindings;
	existingAssetBindings: WebsiteAssetBindings;
	preparation: WebsiteSectionAdditionPreparation;
	section: MaterializedWebsiteSection;
}) => ({
	assetBindings: { ...existingAssetBindings, ...assetBindings },
	snapshot: {
		...preparation.snapshot,
		document: upsertGeneratedSection({
			document: preparation.snapshot.document,
			section,
		}),
	},
});

import { createWebsitePreviewAssetBindings } from "./homepage-preview";
