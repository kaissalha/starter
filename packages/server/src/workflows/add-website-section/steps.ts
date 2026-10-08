import type {
	Iso6391LanguageCode,
	WebsiteAssetBindings,
	WebsiteBriefV1,
	WebsiteSectionAdditionInputV1,
} from "@starter/infinite-website/contracts";

import {
	materializeWebsiteSection,
	settleWebsiteAssetIntents,
	type MaterializedWebsiteSection,
} from "../../services/websites/generation";
import type { WebsiteGenerationRepair } from "../../services/websites/generation-model";
import { createPersistedWebsiteSite } from "../../services/websites/persistence";
import {
	assembleWebsiteSectionAddition,
	generateWebsiteSectionAddition,
	prepareWebsiteSectionAddition,
	type WebsiteSectionAdditionPreparation,
} from "../../services/websites/section-addition";
import { getWebsiteSectionWorkflowContext } from "../website-context";
import {
	emitWebsiteAssetEvents,
	emitWebsitePreparedEvents,
	emitWebsiteSectionEvent,
	throwWebsiteModelError,
} from "../website-steps";

export { bindWebsiteWorkflow, markWebsiteWorkflowFailed, saveWebsiteWorkflow } from "../website-steps";

export type WebsiteSectionAdditionWorkflowInput = {
	expectedRunId: string | null;
	expectedUpdatedAt: string;
	input: WebsiteSectionAdditionInputV1;
	organizationId: string;
	websiteId: string;
};

type PreparedWebsiteSectionAddition = {
	brief: WebsiteBriefV1;
	existingAssetBindings: WebsiteAssetBindings;
	preparation: WebsiteSectionAdditionPreparation;
};

const WEBSITE_SECTION_ADDITION_MAX_RETRIES = 2;

export const prepareWebsiteSectionAdditionStep = async (input: WebsiteSectionAdditionWorkflowInput) => {
	"use step";

	const context = await getWebsiteSectionWorkflowContext(input);
	const preparation = prepareWebsiteSectionAddition({ ...context.generation, input: input.input });

	await emitWebsitePreparedEvents({ slots: [preparation.slot], snapshot: preparation.snapshot });

	return {
		brief: context.generation.brief,
		existingAssetBindings: context.existingAssetBindings,
		preparation,
	};
};

prepareWebsiteSectionAdditionStep.maxRetries = WEBSITE_SECTION_ADDITION_MAX_RETRIES;

export const writeWebsiteSectionAdditionLocalization = async ({
	locale,
	prepared,
	repair,
}: {
	locale: Iso6391LanguageCode;
	prepared: PreparedWebsiteSectionAddition;
	repair?: WebsiteGenerationRepair;
}) => {
	"use step";

	try {
		return await generateWebsiteSectionAddition({
			brief: prepared.brief,
			locale,
			preparation: prepared.preparation,
			repair,
		});
	} catch (error) {
		return throwWebsiteModelError(
			error instanceof Error ? error : new Error("Website section addition call failed")
		);
	}
};

writeWebsiteSectionAdditionLocalization.maxRetries = 3;

export const writeWebsiteSectionAddition = async ({
	input,
	localizations,
	prepared,
}: {
	input: WebsiteSectionAdditionWorkflowInput;
	localizations: Array<
		Extract<Awaited<ReturnType<typeof writeWebsiteSectionAdditionLocalization>>, { status: "valid" }>
	>;
	prepared: PreparedWebsiteSectionAddition;
}) => {
	"use step";

	const materialized = materializeWebsiteSection({
		generatedSection: prepared.preparation.generationSlot,
		localizations: {
			byLocale: Object.fromEntries(localizations.map(({ fields, locale, plan }) => [locale, { fields, plan }])),
			defaultLocale: prepared.preparation.localizations.defaultLocale,
		},
		pages: prepared.preparation.snapshot.document.structure.pages,
		templateId: prepared.preparation.templateId,
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

writeWebsiteSectionAddition.maxRetries = 3;

export const resolveWebsiteSectionAdditionMedia = async ({
	prepared,
}: {
	prepared: PreparedWebsiteSectionAddition;
}) => {
	"use step";

	const resolved = await settleWebsiteAssetIntents({
		brandColors: prepared.preparation.snapshot.brand.colors,
		brief: prepared.brief,
		fallbackAssets: Object.values(prepared.existingAssetBindings),
		intents: prepared.preparation.generationSlot.assetIntents,
	});

	await emitWebsiteAssetEvents(resolved.assets);

	return resolved.assetBindings;
};

resolveWebsiteSectionAdditionMedia.maxRetries = WEBSITE_SECTION_ADDITION_MAX_RETRIES;

export const assembleWebsiteSectionAdditionStep = async ({
	assetBindings,
	materialized,
	prepared,
}: {
	assetBindings: WebsiteAssetBindings;
	materialized: MaterializedWebsiteSection;
	prepared: PreparedWebsiteSectionAddition;
}) => {
	"use step";

	return {
		site: createPersistedWebsiteSite(
			assembleWebsiteSectionAddition({
				assetBindings,
				existingAssetBindings: prepared.existingAssetBindings,
				preparation: prepared.preparation,
				section: materialized,
			})
		),
	};
};

assembleWebsiteSectionAdditionStep.maxRetries = WEBSITE_SECTION_ADDITION_MAX_RETRIES;
