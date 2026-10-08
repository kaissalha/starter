import { FatalError } from "workflow";

import {
	listWebsiteSectionLayouts,
	readWebsiteSectionLayoutContent,
	type WebsiteSectionLayoutTarget,
} from "@starter/infinite-website/editing";
import {
	generationPageKeys,
	listWebsiteLocalizations,
	parseSiteDocument,
	type Iso6391LanguageCode,
	type WebsiteBriefV1,
	type WebsiteGenerationPlan,
	type WebsiteLocalizations,
} from "@starter/infinite-website/generation";

import {
	assembleWebsiteSections,
	materializeWebsiteSection,
	prepareWebsiteGeneration,
	type WebsiteGenerationPreparation,
	type WebsiteSectionGenerationSlot,
} from "../../../src/services/websites/generation";
import {
	assembleWebsiteLayoutGeneration,
	materializeWebsiteLayoutGeneration,
	prepareWebsiteLayoutGeneration,
	type WebsiteLayoutGenerationPreparation,
} from "../../../src/services/websites/layout-generation";
import {
	assembleWebsiteSectionAddition,
	prepareWebsiteSectionAddition,
	type WebsiteSectionAdditionPreparation,
} from "../../../src/services/websites/section-addition";

const websiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const workflowLocales = ["en", "ar"] satisfies Array<Iso6391LanguageCode>;

const brief = {
	location: "Toronto",
	name: "Northstar",
	schemaVersion: 1,
	type: "Design studio",
} satisfies WebsiteBriefV1;

const createPlan = ({ locale }: { locale: Iso6391LanguageCode }): WebsiteGenerationPlan => ({
	kind: "plan",
	pages: generationPageKeys.map((pageKey) => ({
		description: `${locale} ${pageKey} page for Northstar.`,
		pageKey,
		title: `${locale}-${pageKey}`,
	})),
	siteDescription: locale === "ar" ? "استوديو تصميم في تورونتو." : "A design studio in Toronto.",
});

const createFields = ({
	generationSlot,
	locale,
}: {
	generationSlot: WebsiteSectionGenerationSlot;
	locale: Iso6391LanguageCode;
}) =>
	generationSlot.promptSlot.fields.map(({ minWords, path }, fieldIndex) => ({
		path,
		value: Array.from({ length: Math.max(1, minWords) }, (_, wordIndex) =>
			locale === "ar" ? `نص${fieldIndex}-${wordIndex}` : `copy${fieldIndex}-${wordIndex}`
		).join(" "),
	}));

const prepareProfile = async (templateId: string) => {
	"use step";

	return prepareWebsiteGeneration({
		brief,
		plans: workflowLocales.map((locale) => ({
			language: locale === "ar" ? "Arabic" : "English",
			locale,
			plan: createPlan({ locale }),
			status: "valid" as const,
		})),
		templateId,
		websiteId,
	});
};

prepareProfile.maxRetries = 0;

const summarizeProfile = async (preparation: WebsiteGenerationPreparation) => {
	"use step";

	const document = parseSiteDocument(preparation.snapshot.document);

	const sections = [
		...document.structure.layout.header,
		...document.structure.pages.flatMap(({ sections: pageSections }) => pageSections),
		...document.structure.layout.footer,
	];

	return {
		locales: document.locales,
		patternOnlySources: sections.every(({ source }) => source !== undefined && Object.keys(source).length === 1),
		slotCount: preparation.generationSlots.length,
		templateId: preparation.templateId,
	};
};

summarizeProfile.maxRetries = 0;

const completeProfileMatrix = async (profiles: Array<Awaited<ReturnType<typeof summarizeProfile>>>) => {
	"use step";

	return {
		profileCount: profiles.length,
		profiles,
		slotCount: profiles.reduce((total, profile) => total + profile.slotCount, 0),
	};
};

completeProfileMatrix.maxRetries = 0;

export const websiteGenerationSerializationWorkflow = async (templateIds: Array<string>) => {
	"use workflow";

	const profiles = [];

	for (const templateId of templateIds) {
		const preparation = await prepareProfile(templateId);
		profiles.push(await summarizeProfile(preparation));
	}

	return completeProfileMatrix(profiles);
};

const materializeRepeater = async (preparation: WebsiteGenerationPreparation) => {
	"use step";

	const generationSlot = preparation.generationSlots.find(({ slot }) => slot.category === "faq");

	if (!generationSlot) {
		throw new FatalError(`Profile "${preparation.templateId}" has no generated FAQ section`);
	}

	const materialized = materializeWebsiteSection({
		generatedSection: generationSlot,
		localizations: {
			byLocale: Object.fromEntries(
				listWebsiteLocalizations({ localizations: preparation.localizations }).map(({ locale, value }) => [
					locale,
					{ fields: createFields({ generationSlot, locale }), plan: value.plan },
				])
			),
			defaultLocale: preparation.localizations.defaultLocale,
		},
		pages: preparation.snapshot.document.structure.pages,
		templateId: preparation.templateId,
		websiteId,
	});

	if (materialized.target.area !== "page") {
		throw new FatalError("Generated FAQ did not target a page");
	}

	const assembled = assembleWebsiteSections({
		assetBindings: {},
		preparation,
		sections: [materialized],
		skippedSectionIds: [],
	});

	return {
		document: parseSiteDocument(assembled.snapshot.document),
		pattern: materialized.section.source?.pattern,
		target: { ...materialized.target, sectionId: materialized.section.id } satisfies WebsiteSectionLayoutTarget,
	};
};

materializeRepeater.maxRetries = 0;

const summarizeRepeater = async (input: Awaited<ReturnType<typeof materializeRepeater>>) => {
	"use step";

	const source = readWebsiteSectionLayoutContent({ document: input.document, target: input.target });

	if (!source) {
		throw new FatalError(`Generated repeater "${input.pattern}" could not be inspected`);
	}

	const collections = [...source.collectionItemIds].map(([collection, itemIds]) => ({
		collection,
		itemCount: itemIds.length,
		uniqueItemCount: new Set(itemIds).size,
	}));

	return { collections, pattern: input.pattern };
};

summarizeRepeater.maxRetries = 0;

export const websiteRepeaterSerializationWorkflow = async (templateId: string) => {
	"use workflow";

	const preparation = await prepareProfile(templateId);
	const materialized = await materializeRepeater(preparation);

	return summarizeRepeater(materialized);
};

const prepareSectionAddition = async (preparation: WebsiteGenerationPreparation) => {
	"use step";

	const page = preparation.snapshot.document.structure.pages.find(({ home }) => home);

	if (!page) {
		throw new FatalError("Generated website has no home page for section addition");
	}

	return prepareWebsiteSectionAddition({
		brief,
		input: { index: 1, pageId: page.id, pattern: "text-basic", schemaVersion: 1 },
		snapshot: preparation.snapshot,
		websiteId,
		workflowRunId: "workflow-section-addition-integration",
	});
};

prepareSectionAddition.maxRetries = 0;

const completeSectionAddition = async (preparation: WebsiteSectionAdditionPreparation) => {
	"use step";

	const materialized = materializeWebsiteSection({
		generatedSection: preparation.generationSlot,
		localizations: {
			byLocale: Object.fromEntries(
				listWebsiteLocalizations({ localizations: preparation.localizations }).map(({ locale, value }) => [
					locale,
					{
						fields: createFields({ generationSlot: preparation.generationSlot, locale }),
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

	const assembled = assembleWebsiteSectionAddition({
		assetBindings: {},
		existingAssetBindings: {},
		preparation,
		section: materialized,
	});

	const document = parseSiteDocument(assembled.snapshot.document);

	return {
		locales: document.locales.filter(
			(locale) => document.content[locale]?.sections[materialized.section.contentId] !== undefined
		),
		pattern: materialized.section.source?.pattern,
		sectionId: materialized.section.id,
	};
};

completeSectionAddition.maxRetries = 0;

const prepareLayoutGeneration = async (preparation: WebsiteGenerationPreparation) => {
	"use step";

	for (const page of preparation.snapshot.document.structure.pages) {
		for (const [index, section] of page.sections.entries()) {
			const target = { area: "page" as const, index, pageId: page.id, sectionId: section.id };

			const candidate = listWebsiteSectionLayouts({
				document: preparation.snapshot.document,
				target,
			}).find(({ generationRequired }) => generationRequired);

			if (candidate) {
				return prepareWebsiteLayoutGeneration({
					brief,
					input: { pattern: candidate.pattern, schemaVersion: 1, target },
					snapshot: preparation.snapshot,
					websiteId,
					workflowRunId: "workflow-layout-generation-integration",
				});
			}
		}
	}

	throw new FatalError(`Profile "${preparation.templateId}" has no generative layout candidate`);
};

prepareLayoutGeneration.maxRetries = 0;

const completeLayoutGeneration = async (preparation: WebsiteLayoutGenerationPreparation) => {
	"use step";

	const generated = {
		byLocale: Object.fromEntries(
			listWebsiteLocalizations({ localizations: preparation.localizations }).map(({ locale }) => [
				locale,
				preparation.missingTextPointers.map((path, index) => ({ path, value: `${locale} layout ${index}` })),
			])
		),
		defaultLocale: preparation.localizations.defaultLocale,
	} satisfies WebsiteLocalizations<Array<{ path: string; value: string }>>;

	const section = materializeWebsiteLayoutGeneration({ generated, preparation });

	const assembled = assembleWebsiteLayoutGeneration({
		assetBindings: {},
		existingAssetBindings: {},
		preparation,
		section,
	});

	const document = parseSiteDocument(assembled.snapshot.document);

	return {
		locales: document.locales.filter(
			(locale) => document.content[locale]?.sections[section.section.contentId] !== undefined
		),
		pattern: section.section.source?.pattern,
		preservedSectionId: section.section.id === preparation.identity.id,
	};
};

completeLayoutGeneration.maxRetries = 0;

export const websiteMutationSerializationWorkflow = async (templateId: string) => {
	"use workflow";

	const preparation = await prepareProfile(templateId);

	const [sectionAddition, layoutGeneration] = await Promise.all([
		(async () => completeSectionAddition(await prepareSectionAddition(preparation)))(),
		(async () => completeLayoutGeneration(await prepareLayoutGeneration(preparation)))(),
	]);

	return { layoutGeneration, sectionAddition };
};
