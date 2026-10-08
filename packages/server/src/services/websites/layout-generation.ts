import type { LanguageModel } from "ai";

import type { LinkValue } from "@starter/infinite-website";
import {
	createWebsiteSectionLayoutEntityId,
	createWebsiteSectionLayoutPreview,
	getWebsiteSectionLayoutCollectionItemCounts,
	getWebsiteSectionLayoutDefinition,
	readWebsiteSectionLayoutContent,
} from "@starter/infinite-website/editing";
import {
	createSectionTextContentFromFields,
	entityIdFromSeed,
	instantiateSection,
	listSectionContentPointers,
	listWebsiteLocalizations,
	pendingTextContent,
	materializeSectionContent,
	upsertGeneratedSection,
	resolveWebsiteGenerationProfile,
	websiteGenerationSectionCategories,
	websiteSnapshotSchema,
	type Iso6391LanguageCode,
	type SectionDefinition,
	type WebsiteAssetBindings,
	type WebsiteBriefV1,
	type WebsiteGenerationEventV1,
	type WebsiteGenerationPlan,
	type WebsiteGenerationSlotV1,
	type WebsiteLayoutGenerationInputV1,
	type WebsiteLayoutGenerationTargetV1,
	type WebsiteLocalizations,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";

import { createWebsiteLayoutGenerationPrompt, createWebsiteSectionOutputSchema } from "../../ai/prompts";
import { models } from "../../mastra/models";
import { createWebsiteBrandMarkAsset, WEBSITE_PLACEHOLDER_ASSET, type WebsiteAssetIntent } from "./assets";
import { createWebsitePromptFields, listWebsiteSnapshotLocalizations } from "./generation";
import { listWebsiteDefinitionLinks, websiteLinkLabels } from "./generation-actions";
import { runWebsiteObjectGeneration, type WebsiteGenerationRepair } from "./generation-model";
import { resolveWebsiteAssetStockRole } from "./generation-slots";
import { createWebsiteLayoutPreviewTarget, saveWebsitePreviewFields, type WebsitePreviewScope } from "./preview-cache";

type LayoutSourceValues = {
	assets: Array<{ pointer: string; value: string }>;
	links: Array<{ pointer: string; value: LinkValue }>;
	text: Array<{ pointer: string; value: string }>;
};

type LayoutLocalization = {
	language: string;
	page: { description: string; title: string } | null;
	plan: WebsiteGenerationPlan;
	source: LayoutSourceValues;
};

export class WebsiteLayoutGenerationInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "WebsiteLayoutGenerationInputError";
	}
}

const createWebsiteLayoutSection = ({
	assetIdByPointer,
	collectionItemCounts,
	collectionItemIds,
	defaultLocale,
	definition,
	identity,
	localizations,
	pages,
	pattern,
	target,
}: {
	assetIdByPointer: Record<string, string>;
	collectionItemCounts: ReadonlyMap<string, number>;
	collectionItemIds: ReadonlyMap<string, Array<string>>;
	defaultLocale: Iso6391LanguageCode;
	definition: SectionDefinition;
	identity: { anchor: string; contentId: string; id: string };
	localizations: WebsiteLocalizations<{
		fields: Array<{ path: string; value: string }>;
		plan: WebsiteGenerationPlan;
		source: LayoutSourceValues;
	}>;
	pages: WebsiteSnapshotV1["document"]["structure"]["pages"];
	pattern: string;
	target: WebsiteLayoutGenerationTargetV1;
}) => {
	const targetTextPointers = listSectionContentPointers({ collectionItemCounts, definition, kind: "text" });
	const definitionLinks = listWebsiteDefinitionLinks({ collectionItemCounts, definition });
	const navigationLinks = definitionLinks.filter(({ navigation }) => navigation);

	const labelLinks = new Map(
		definitionLinks.flatMap(({ labels, path }) => labels.map((label) => [label, path] as const))
	);

	const content = Object.fromEntries(
		listWebsiteLocalizations({ localizations }).map(({ locale, value }) => {
			const sourceText = new Map(value.source.text.map(({ pointer, value: text }) => [pointer, text]));
			const generatedText = new Map(value.fields.map(({ path, value: text }) => [path, text]));
			const sourceLinks = new Map(value.source.links.map(({ pointer, value: link }) => [pointer, link]));

			const readLink = (pointer: string): LinkValue => {
				const existing = sourceLinks.get(pointer);

				if (existing) {
					return existing;
				}

				const navigationIndex = navigationLinks.findIndex(({ path }) => path === pointer);

				const pageIndex =
					navigationIndex >= 0
						? navigationIndex % pages.length
						: value.plan.pages.findIndex(({ pageKey }) => pageKey === "contact");

				const page = target.area === "page" ? pages.find(({ id }) => id === target.pageId) : pages[pageIndex];

				if (!page) {
					throw new Error(`Website layout generation could not bind link "${pointer}"`);
				}

				return { kind: "page", pageId: page.id };
			};

			const materialized = materializeSectionContent({
				collectionItemCounts,
				createAssetId: ({ pointer }) => {
					const assetId = assetIdByPointer[pointer];

					if (!assetId) {
						throw new Error(`Website layout generation could not bind asset "${pointer}"`);
					}

					return assetId;
				},
				createLink: ({ pointer }) => readLink(pointer),
				definition,
				text: createSectionTextContentFromFields({
					collectionItemCounts,
					definition,
					fields: targetTextPointers.map((path) => {
						const linkPath = labelLinks.get(path);

						if (linkPath && (!sourceText.has(path) || !sourceLinks.has(linkPath))) {
							const link = readLink(linkPath);

							const pageIndex =
								link.kind === "page" ? pages.findIndex(({ id }) => id === link.pageId) : -1;

							return {
								path,
								value: websiteLinkLabels({
									link,
									locale,
									pageKey: value.plan.pages[pageIndex]?.pageKey,
								})[0]!,
							};
						}

						return { path, value: sourceText.get(path) ?? generatedText.get(path) ?? pendingTextContent };
					}),
				}),
			});

			return [locale, materialized.content];
		})
	);

	const instancePath = `/website-layout-generations/${target.sectionId}/${pattern}`;

	const instance = instantiateSection({
		anchor: identity.anchor,
		content,
		createId: ({ kind, path }) =>
			createWebsiteSectionLayoutEntityId({
				collectionItemIds,
				instancePath,
				kind,
				path,
				seed: `website-layout-generation:${target.sectionId}:${pattern}:${kind}:${path}`,
			}),
		defaultLocale,
		definition,
		path: instancePath,
	});

	const eventTarget: Extract<WebsiteGenerationEventV1, { type: "section" }>["target"] =
		target.area === "page"
			? { area: target.area, index: target.index, pageId: target.pageId }
			: { area: target.area, index: target.index };

	return {
		content: instance.content,
		section: {
			...instance.section,
			...identity,
		},
		target: eventTarget,
	};
};

export const prepareWebsiteLayoutGeneration = ({
	brief,
	input,
	snapshot,
	websiteId,
	workflowRunId,
}: {
	brief: WebsiteBriefV1;
	input: WebsiteLayoutGenerationInputV1;
	snapshot: WebsiteSnapshotV1;
	websiteId: string;
	workflowRunId: string;
}) => {
	const source = readWebsiteSectionLayoutContent({ document: snapshot.document, target: input.target });
	const definition = getWebsiteSectionLayoutDefinition({ pattern: input.pattern });

	if (!source || !definition || source.section.category !== definition.category) {
		throw new WebsiteLayoutGenerationInputError("Website layout generation target is invalid");
	}

	if (
		input.target.area === "page" &&
		!websiteGenerationSectionCategories.some((category) => category === definition.category)
	) {
		throw new WebsiteLayoutGenerationInputError(`Category "${definition.category}" cannot generate new content`);
	}

	const profile = resolveWebsiteGenerationProfile({ brief, templateId: snapshot.templateId });

	const collectionItemCounts = getWebsiteSectionLayoutCollectionItemCounts({
		collectionItemIds: source.collectionItemIds,
		definition,
	});

	const targetTextPointers = listSectionContentPointers({ collectionItemCounts, definition, kind: "text" });
	const targetAssetPointers = listSectionContentPointers({ collectionItemCounts, definition, kind: "asset" });
	const defaultSource = source.locales[snapshot.document.defaultLocale];

	if (!defaultSource) {
		throw new Error("Website layout generation is missing default source content");
	}

	const defaultSourceText = new Set(defaultSource.text.map(({ pointer }) => pointer));
	const missingTextPointers = targetTextPointers.filter((pointer) => !defaultSourceText.has(pointer));
	const slotKey = `layout-generations.${workflowRunId}`;

	const sourceDefinition = source.section.source?.pattern
		? getWebsiteSectionLayoutDefinition({ pattern: source.section.source.pattern })
		: undefined;

	const reusableSourceAssets = new Map(
		defaultSource.assets
			.filter(({ pointer }) => {
				if (!sourceDefinition) {
					return false;
				}

				return (
					resolveWebsiteAssetStockRole({ area: input.target.area, definition: sourceDefinition, pointer }) ===
					resolveWebsiteAssetStockRole({ area: input.target.area, definition, pointer })
				);
			})
			.map(({ pointer, value }) => [pointer, value])
	);

	const stockIndexReference = { value: 0 };

	const assetIdByPointer = Object.fromEntries(
		targetAssetPointers.map((pointer) => [
			pointer,
			reusableSourceAssets.get(pointer) ??
				entityIdFromSeed({
					seed: `website-layout-generation:${websiteId}:${input.target.sectionId}:${input.pattern}:asset:${pointer}`,
				}),
		])
	);

	const assetIntents = targetAssetPointers.flatMap((pointer) => {
		if (reusableSourceAssets.has(pointer)) {
			return [];
		}

		const stockRole = resolveWebsiteAssetStockRole({ area: input.target.area, definition, pointer });
		const stockIndex = stockRole === null ? 0 : stockIndexReference.value++;

		return [
			{
				assetId: assetIdByPointer[pointer]!,
				profileKeyword: profile.keywords[0] ?? "business",
				searchable: stockRole !== null,
				sectionCategory: definition.category,
				sectionPurpose: `Complete the selected ${definition.category} layout.`,
				slotKey,
				stockIndex,
				stockRole,
			} satisfies WebsiteAssetIntent,
		];
	});

	const localizationEntries = listWebsiteSnapshotLocalizations({ brief, snapshot }).map(
		({ language, locale, localized, plan }) => {
			const sourceValues = source.locales[locale];

			if (!sourceValues) {
				throw new Error(`Website layout generation is missing context for "${locale}"`);
			}

			const targetPageId = input.target.area === "page" ? input.target.pageId : undefined;

			const page = targetPageId
				? snapshot.document.structure.pages.find(({ id }) => id === targetPageId)
				: snapshot.document.structure.pages.find(({ home }) => home);

			const pageContent = page ? localized.pages[page.id] : undefined;

			return [
				locale,
				{
					language,
					page: pageContent?.seo?.title
						? {
								description: pageContent.seo.description ?? plan.siteDescription,
								title: pageContent.seo.title,
							}
						: null,
					plan,
					source: sourceValues,
				},
			] as const;
		}
	);

	const localizations: WebsiteLocalizations<LayoutLocalization> = {
		byLocale: Object.fromEntries(localizationEntries),
		defaultLocale: snapshot.document.defaultLocale,
	};

	const placeholder = createWebsiteLayoutSection({
		assetIdByPointer,
		collectionItemCounts,
		collectionItemIds: source.collectionItemIds,
		defaultLocale: localizations.defaultLocale,
		definition,
		identity: {
			anchor: source.section.anchor,
			contentId: source.section.contentId,
			id: source.section.id,
		},
		localizations: {
			byLocale: Object.fromEntries(
				listWebsiteLocalizations({ localizations }).map(({ locale, value }) => [
					locale,
					{
						fields: missingTextPointers.map((path) => ({
							path,
							value: pendingTextContent,
						})),
						plan: value.plan,
						source: value.source,
					},
				])
			),
			defaultLocale: localizations.defaultLocale,
		},
		pages: snapshot.document.structure.pages,
		pattern: input.pattern,
		target: input.target,
	});

	const assets = {
		...snapshot.assets,
		...Object.fromEntries(
			assetIntents.map((intent) => [
				intent.assetId,
				intent.stockRole === null
					? createWebsiteBrandMarkAsset({ brandColors: snapshot.brand.colors, businessName: brief.name })
					: WEBSITE_PLACEHOLDER_ASSET,
			])
		),
	};

	return {
		assetIdByPointer,
		assetIntents,
		collectionItemCounts: [...collectionItemCounts],
		collectionItemIds: [...source.collectionItemIds],
		definitionCategory: definition.category,
		identity: {
			anchor: source.section.anchor,
			contentId: source.section.contentId,
			id: source.section.id,
		},
		input,
		localizations,
		missingTextPointers,
		pattern: input.pattern,
		slot: {
			assetIds: assetIntents.flatMap(({ assetId, searchable }) => (searchable ? [assetId] : [])),
			sectionId: source.section.id,
			slotKey,
			target: placeholder.target,
		} satisfies WebsiteGenerationSlotV1,
		snapshot: websiteSnapshotSchema.parse({
			...snapshot,
			assets,
			document: upsertGeneratedSection({ document: snapshot.document, section: placeholder }),
		}),
		templateName: profile.name,
		websiteId,
	};
};

export type WebsiteLayoutGenerationPreparation = ReturnType<typeof prepareWebsiteLayoutGeneration>;

export const generateWebsiteLayoutContent = async ({
	abortSignal,
	brief,
	cachedFields,
	locale,
	model = models.websiteGeneration.model,
	preparation,
	repair,
}: {
	abortSignal?: AbortSignal;
	brief: WebsiteBriefV1;
	cachedFields?: Array<{ path: string; value: string }>;
	locale: Iso6391LanguageCode;
	model?: LanguageModel;
	preparation: WebsiteLayoutGenerationPreparation;
	repair?: WebsiteGenerationRepair;
}) => {
	abortSignal?.throwIfAborted();
	const value = preparation.localizations.byLocale[locale];
	const definition = getWebsiteSectionLayoutDefinition({ pattern: preparation.pattern });

	if (!value || !definition) {
		throw new Error(`Website layout generation is missing localization or pattern "${locale}"`);
	}

	if (preparation.missingTextPointers.length === 0) {
		return { fields: [], locale, status: "valid" as const };
	}

	const labelPaths = new Set(
		listWebsiteDefinitionLinks({
			collectionItemCounts: new Map(preparation.collectionItemCounts),
			definition,
		}).flatMap(({ labels }) => labels)
	);

	const slot = {
		fields: createWebsitePromptFields({
			definition,
			paths: preparation.missingTextPointers.filter((path) => !labelPaths.has(path)),
		}),
		pageKey: value.plan.pages.find(({ title }) => title === value.page?.title)?.pageKey,
		purpose: `Complete the selected ${definition.category} layout without rewriting existing fields.`,
		sectionType: definition.category,
		slotKey: preparation.slot.slotKey,
	};

	if (slot.fields.length === 0) {
		return { fields: [], locale, status: "valid" as const };
	}

	const schema = createWebsiteSectionOutputSchema({ slot });

	if (cachedFields && !repair) {
		const values = new Map(cachedFields.map(({ path, value: text }) => [path, text]));

		const cached = schema.safeParse(
			Object.fromEntries(slot.fields.map(({ key, path }) => [key, values.get(path)]))
		);

		if (cached.success) {
			return { fields: cached.data.fields, locale, status: "valid" as const };
		}
	}

	const generated = await runWebsiteObjectGeneration({
		abortSignal,
		model,
		prompt: createWebsiteLayoutGenerationPrompt({
			brief,
			category: definition.category,
			existingFields: value.source.text.map(({ pointer, value: text }) => ({ path: pointer, value: text })),
			language: value.language,
			page: value.page,
			pattern: preparation.pattern,
			slot,
		}),
		repair,
		schema,
		telemetryFunctionId: "website-layout-generation",
	});

	if (generated.status !== "valid") {
		return { locale, ...generated };
	}

	return { fields: generated.output.fields, locale, status: "valid" as const };
};

export const materializeWebsiteLayoutGeneration = ({
	generated,
	preparation,
}: {
	generated: WebsiteLocalizations<Array<{ path: string; value: string }>>;
	preparation: WebsiteLayoutGenerationPreparation;
}) => {
	const definition = getWebsiteSectionLayoutDefinition({ pattern: preparation.pattern });

	if (!definition) {
		throw new Error(`Website layout generation pattern "${preparation.pattern}" is missing`);
	}

	return createWebsiteLayoutSection({
		assetIdByPointer: preparation.assetIdByPointer,
		collectionItemCounts: new Map(preparation.collectionItemCounts),
		collectionItemIds: new Map(preparation.collectionItemIds),
		defaultLocale: preparation.localizations.defaultLocale,
		definition,
		identity: preparation.identity,
		localizations: {
			byLocale: Object.fromEntries(
				listWebsiteLocalizations({ localizations: preparation.localizations }).map(({ locale, value }) => [
					locale,
					{ fields: generated.byLocale[locale] ?? [], plan: value.plan, source: value.source },
				])
			),
			defaultLocale: preparation.localizations.defaultLocale,
		},
		pages: preparation.snapshot.document.structure.pages,
		pattern: preparation.pattern,
		target: preparation.input.target,
	});
};

export const assembleWebsiteLayoutGeneration = ({
	assetBindings,
	existingAssetBindings,
	preparation,
	section,
}: {
	assetBindings: WebsiteAssetBindings;
	existingAssetBindings: WebsiteAssetBindings;
	preparation: WebsiteLayoutGenerationPreparation;
	section: ReturnType<typeof materializeWebsiteLayoutGeneration>;
}) => ({
	assetBindings: { ...existingAssetBindings, ...assetBindings },
	snapshot: {
		...preparation.snapshot,
		document: upsertGeneratedSection({ document: preparation.snapshot.document, section }),
	},
});

export const generateWebsiteLayoutPreview = async ({
	abortSignal,
	brief,
	input,
	locale,
	previewScope,
	snapshot,
	websiteId,
}: {
	abortSignal?: AbortSignal;
	brief: WebsiteBriefV1;
	input: WebsiteLayoutGenerationInputV1;
	locale: Iso6391LanguageCode;
	previewScope?: WebsitePreviewScope;
	snapshot: WebsiteSnapshotV1;
	websiteId: string;
}) => {
	const preparation = prepareWebsiteLayoutGeneration({
		brief,
		input,
		snapshot,
		websiteId,
		workflowRunId: `preview-${input.pattern}`,
	});

	const generated = await generateWebsiteLayoutContent({ abortSignal, brief, locale, preparation });

	if (generated.status !== "valid") {
		throw new Error("Website layout preview copy failed validation");
	}

	abortSignal?.throwIfAborted();

	if (previewScope) {
		await saveWebsitePreviewFields({
			fields: generated.fields,
			scope: previewScope,
			target: createWebsiteLayoutPreviewTarget({ input, locale }),
		});
	}

	const document = createWebsiteSectionLayoutPreview({
		document: snapshot.document,
		generated,
		pattern: input.pattern,
		target: input.target,
	});

	if (!document) {
		throw new WebsiteLayoutGenerationInputError("Website layout preview target is invalid");
	}

	return { ...snapshot, document };
};
