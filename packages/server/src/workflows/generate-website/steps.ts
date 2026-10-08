import { FatalError, getStepMetadata } from "workflow";

import {
	websiteGenerationLocales,
	type Iso6391LanguageCode,
	type WebsiteBriefV1,
} from "@starter/infinite-website/generation";
import { createLogger, log, serializeLogError } from "@starter/observability";

import { createWebsiteSectionOutputSchema } from "../../ai/prompts";
import {
	assembleWebsiteSections,
	generateWebsitePlan,
	selectWebsiteGenerationBrand,
	generateWebsiteSection,
	materializeWebsiteSection,
	prepareWebsiteGeneration,
	resolveWebsiteGenerationMedia,
	type MaterializedWebsiteSection,
	type WebsiteGenerationPreparation,
	type WebsiteSectionGenerationSlot,
} from "../../services/websites/generation";
import type { WebsiteGenerationRepair } from "../../services/websites/generation-model";
import { createPersistedWebsiteSite } from "../../services/websites/persistence";
import { readWebsitePreviewFields } from "../../services/websites/preview-cache";
import {
	emitWebsiteAssetEvents,
	emitWebsiteSectionEvent,
	emitWebsiteWorkflowEvents,
	throwWebsiteModelError,
} from "../website-steps";

export { bindWebsiteWorkflow, markWebsiteWorkflowFailed, saveWebsiteWorkflow } from "../website-steps";

export type WebsiteWorkflowInput = {
	brief: WebsiteBriefV1;
	expectedRunId: string | null;
	organizationId: string;
	websiteId: string;
} & ({ expectedUpdatedAt?: undefined; templateId?: undefined } | { expectedUpdatedAt: string; templateId: string });

const WEBSITE_GENERATION_MAX_RETRIES = 2;

const WEBSITE_MODEL_STEP_MAX_RETRIES = 3;

export type WebsiteGenerationTimeline = {
	counts: Record<string, number>;
	kind: "generation" | "template-change";
	organizationId: string;
	outcome: "completed" | "failed";
	stages: Record<string, number>;
	websiteId: string;
};

export const recordWebsiteGenerationTimeline = async (timeline: WebsiteGenerationTimeline) => {
	"use step";

	try {
		createLogger({ message: "Website generation timeline", ...timeline }).emit({ _forceKeep: true });
	} catch (error) {
		log.warn({ error: serializeLogError(error), message: "Website generation timeline was not recorded" });
	}
};

recordWebsiteGenerationTimeline.maxRetries = 0;

export const selectWebsiteBrand = async (input: WebsiteWorkflowInput) => {
	"use step";

	await emitWebsiteWorkflowEvents({
		events: [{ eventKey: "status:planning", stage: "planning", type: "status", version: 1 }],
	});

	if (input.templateId) {
		return null;
	}

	return selectWebsiteGenerationBrand({ brief: input.brief, websiteId: input.websiteId });
};

selectWebsiteBrand.maxRetries = WEBSITE_GENERATION_MAX_RETRIES;

export const writeWebsitePlan = async ({
	input,
	locale,
	repair,
}: {
	input: WebsiteWorkflowInput;
	locale: Iso6391LanguageCode;
	repair?: WebsiteGenerationRepair;
}) => {
	"use step";

	try {
		return await generateWebsitePlan({
			brief: input.brief,
			locale,
			repair,
			templateId: input.templateId ?? "custom",
		});
	} catch (error) {
		return throwWebsiteModelError(error instanceof Error ? error : new Error("Website plan call failed"));
	}
};

writeWebsitePlan.maxRetries = WEBSITE_MODEL_STEP_MAX_RETRIES;

export const prepareWebsite = async ({
	brand,
	input,
	plans,
	templateId,
}: {
	brand: Awaited<ReturnType<typeof selectWebsiteBrand>>;
	input: WebsiteWorkflowInput;
	plans: Array<Extract<Awaited<ReturnType<typeof writeWebsitePlan>>, { status: "valid" }>>;
	templateId: string;
}) => {
	"use step";

	const preparation = prepareWebsiteGeneration({
		brand,
		brief: input.brief,
		plans,
		templateId,
		websiteId: input.websiteId,
	});

	await emitWebsiteWorkflowEvents({
		events: [
			{
				eventKey: "prepared",
				slots: preparation.slots,
				snapshot: preparation.snapshot,
				type: "prepared",
				version: 1,
			},
			{ eventKey: "status:writing", stage: "writing", type: "status", version: 1 },
		],
	});

	if (!input.templateId) {
		return preparation;
	}

	const previewFields = await readWebsitePreviewFields({
		scope: { organizationId: input.organizationId, revision: input.expectedUpdatedAt, websiteId: input.websiteId },
		targets: preparation.generationSlots.flatMap(({ slot }) =>
			websiteGenerationLocales.map((locale) => JSON.stringify([templateId, slot.slotKey, locale]))
		),
	});

	return { ...preparation, previewFields };
};

prepareWebsite.maxRetries = WEBSITE_GENERATION_MAX_RETRIES;

type WebsiteSectionLocalizationOutcome = { previewCacheHit: boolean; status: "error" | "repair" | "valid" };

const writeWebsiteSectionLocalization = async ({
	generationSlot,
	input,
	locale,
	preparation,
	repair,
}: {
	generationSlot: WebsiteSectionGenerationSlot;
	input: WebsiteWorkflowInput;
	locale: Iso6391LanguageCode;
	preparation: WebsiteGenerationPreparation;
	repair?: WebsiteGenerationRepair;
}) => {
	const startedAtMs = Date.now();
	const localization = preparation.localizations.byLocale[locale];
	const outcome: WebsiteSectionLocalizationOutcome = { previewCacheHit: false, status: "error" };

	if (!localization) {
		throw new Error(`Website generation is missing localization "${locale}"`);
	}

	try {
		const cached =
			preparation.previewFields?.[JSON.stringify([preparation.templateId, generationSlot.slot.slotKey, locale])];

		if (cached && !repair && generationSlot.promptSlot.fields.length > 0) {
			const fields = new Map(cached.map(({ path, value }) => [path, value]));

			const parsed = createWebsiteSectionOutputSchema({ slot: generationSlot.promptSlot }).safeParse(
				Object.fromEntries(generationSlot.promptSlot.fields.map(({ key, path }) => [key, fields.get(path)]))
			);

			if (parsed.success) {
				outcome.status = "valid";
				outcome.previewCacheHit = true;

				return { fields: parsed.data.fields, locale, plan: localization.plan, status: "valid" as const };
			}
		}

		const generated = await generateWebsiteSection({
			brief: input.brief,
			generationSlot,
			language: localization.language,
			plan: localization.plan,
			repair,
			templateName: preparation.templateName,
		});

		outcome.status = generated.status;

		return { locale, plan: localization.plan, ...generated };
	} catch (error) {
		return throwWebsiteModelError(error instanceof Error ? error : new Error("Website section call failed"));
	} finally {
		log.info({
			isRepair: repair !== undefined,
			locale,
			message: "Website section localization settled",
			modelCallStatus: outcome.status,
			organizationId: input.organizationId,
			previewCacheHit: outcome.previewCacheHit,
			retryCount: Math.max(0, getStepMetadata().attempt - 1),
			slotKey: generationSlot.slot.slotKey,
			slotLatencyMs: Math.max(0, Date.now() - startedAtMs),
			websiteId: input.websiteId,
		});
	}
};

export const writeWebsiteSection = async ({
	generationSlot,
	input,
	preparation,
}: {
	generationSlot: WebsiteSectionGenerationSlot;
	input: WebsiteWorkflowInput;
	preparation: WebsiteGenerationPreparation;
}) => {
	"use step";

	const localizations = await Promise.all(
		websiteGenerationLocales.map(async (locale) => {
			const generated = await writeWebsiteSectionLocalization({ generationSlot, input, locale, preparation });

			if (generated.status === "valid") {
				return generated;
			}

			const repaired = await writeWebsiteSectionLocalization({
				generationSlot,
				input,
				locale,
				preparation,
				repair: generated,
			});

			if (repaired.status !== "valid") {
				throw new FatalError(
					`Website section repair failed for "${locale}" in ${generationSlot.slot.slotKey}: ${repaired.validationError}`
				);
			}

			return repaired;
		})
	);

	const materialized = materializeWebsiteSection({
		generatedSection: generationSlot,
		localizations: {
			byLocale: Object.fromEntries(localizations.map(({ fields, locale, plan }) => [locale, { fields, plan }])),
			defaultLocale: preparation.localizations.defaultLocale,
		},
		pages: preparation.snapshot.document.structure.pages,
		templateId: preparation.templateId,
		websiteId: input.websiteId,
	});

	await emitWebsiteSectionEvent({
		content: materialized.content,
		section: materialized.section,
		slotKey: materialized.slotKey,
		target: materialized.target,
	});

	return materialized;
};

writeWebsiteSection.maxRetries = WEBSITE_MODEL_STEP_MAX_RETRIES;

export const resolveWebsiteMedia = async ({
	brand,
	input,
	templateId,
}: {
	brand: Awaited<ReturnType<typeof selectWebsiteBrand>>;
	input: WebsiteWorkflowInput;
	templateId: string;
}) => {
	"use step";

	return resolveWebsiteGenerationMedia({ brand, brief: input.brief, templateId, websiteId: input.websiteId });
};

resolveWebsiteMedia.maxRetries = WEBSITE_GENERATION_MAX_RETRIES;

export const settleWebsiteMedia = async ({
	resolved,
}: {
	resolved: Awaited<ReturnType<typeof resolveWebsiteMedia>>;
}) => {
	"use step";

	await emitWebsiteAssetEvents(resolved.assets);

	return resolved.assetBindings;
};

settleWebsiteMedia.maxRetries = WEBSITE_GENERATION_MAX_RETRIES;

export const skipWebsiteSection = async ({
	generationSlot,
	preparation,
}: {
	generationSlot: WebsiteSectionGenerationSlot;
	preparation: WebsiteGenerationPreparation;
}) => {
	"use step";

	const slot = preparation.slots.find(({ slotKey }) => slotKey === generationSlot.slot.slotKey);

	if (!slot) {
		throw new Error(`Website generation slot "${generationSlot.slot.slotKey}" is missing`);
	}

	await emitWebsiteWorkflowEvents({
		events: [
			{
				eventKey: `section-skipped:${slot.sectionId}`,
				sectionId: slot.sectionId,
				slotKey: slot.slotKey,
				type: "section-skipped",
				version: 1,
			},
		],
	});

	return slot.sectionId;
};

skipWebsiteSection.maxRetries = WEBSITE_GENERATION_MAX_RETRIES;

export const assembleWebsite = async ({
	assetBindings,
	preparation,
	sections,
	skippedSectionIds,
}: {
	assetBindings: Awaited<ReturnType<typeof settleWebsiteMedia>>;
	preparation: WebsiteGenerationPreparation;
	sections: Array<MaterializedWebsiteSection>;
	skippedSectionIds: Array<string>;
}) => {
	"use step";

	return {
		site: createPersistedWebsiteSite(
			assembleWebsiteSections({ assetBindings, preparation, sections, skippedSectionIds })
		),
	};
};

assembleWebsite.maxRetries = WEBSITE_GENERATION_MAX_RETRIES;
