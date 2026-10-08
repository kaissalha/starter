import type {
	Iso6391LanguageCode,
	WebsiteAssetBindings,
	WebsiteBriefV1,
	WebsiteLayoutGenerationInputV1,
	WebsiteLocalizations,
} from "@starter/infinite-website/contracts";
import { websiteGenerationLocales } from "@starter/infinite-website/generation";

import { settleWebsiteAssetIntents } from "../../services/websites/generation";
import type { WebsiteGenerationRepair } from "../../services/websites/generation-model";
import {
	assembleWebsiteLayoutGeneration,
	generateWebsiteLayoutContent,
	materializeWebsiteLayoutGeneration,
	prepareWebsiteLayoutGeneration,
	type WebsiteLayoutGenerationPreparation,
} from "../../services/websites/layout-generation";
import { createPersistedWebsiteSite } from "../../services/websites/persistence";
import { createWebsiteLayoutPreviewTarget, readWebsitePreviewFields } from "../../services/websites/preview-cache";
import { getWebsiteSectionWorkflowContext } from "../website-context";
import {
	emitWebsiteAssetEvents,
	emitWebsitePreparedEvents,
	emitWebsiteSectionEvent,
	throwWebsiteModelError,
} from "../website-steps";

export { bindWebsiteWorkflow, markWebsiteWorkflowFailed, saveWebsiteWorkflow } from "../website-steps";

export type WebsiteLayoutGenerationWorkflowInput = {
	expectedRunId: string | null;
	expectedUpdatedAt: string;
	input: WebsiteLayoutGenerationInputV1;
	organizationId: string;
	websiteId: string;
};

type PreparedWebsiteLayoutGeneration = {
	brief: WebsiteBriefV1;
	existingAssetBindings: WebsiteAssetBindings;
	preparation: WebsiteLayoutGenerationPreparation;
	previewFields?: Record<string, Array<{ path: string; value: string }>>;
};

const WEBSITE_LAYOUT_GENERATION_MAX_RETRIES = 2;

export const prepareWebsiteLayoutGenerationStep = async (input: WebsiteLayoutGenerationWorkflowInput) => {
	"use step";

	const context = await getWebsiteSectionWorkflowContext(input);
	const preparation = prepareWebsiteLayoutGeneration({ ...context.generation, input: input.input });

	await emitWebsitePreparedEvents({ slots: [preparation.slot], snapshot: preparation.snapshot });

	const cached = await readWebsitePreviewFields({
		scope: { organizationId: input.organizationId, revision: input.expectedUpdatedAt, websiteId: input.websiteId },
		targets: websiteGenerationLocales.map((locale) =>
			createWebsiteLayoutPreviewTarget({ input: input.input, locale })
		),
	});

	const previewFields = Object.fromEntries(
		websiteGenerationLocales.flatMap((locale) => {
			const fields = cached[createWebsiteLayoutPreviewTarget({ input: input.input, locale })];

			return fields ? [[locale, fields]] : [];
		})
	);

	return {
		brief: context.generation.brief,
		existingAssetBindings: context.existingAssetBindings,
		preparation,
		previewFields,
	};
};

prepareWebsiteLayoutGenerationStep.maxRetries = WEBSITE_LAYOUT_GENERATION_MAX_RETRIES;

export const writeWebsiteLayoutLocalization = async ({
	locale,
	prepared,
	repair,
}: {
	locale: Iso6391LanguageCode;
	prepared: PreparedWebsiteLayoutGeneration;
	repair?: WebsiteGenerationRepair;
}) => {
	"use step";

	try {
		return await generateWebsiteLayoutContent({
			brief: prepared.brief,
			cachedFields: prepared.previewFields?.[locale],
			locale,
			preparation: prepared.preparation,
			repair,
		});
	} catch (error) {
		return throwWebsiteModelError(error instanceof Error ? error : new Error("Website layout call failed"));
	}
};

writeWebsiteLayoutLocalization.maxRetries = 3;

export const writeWebsiteLayoutGeneration = async ({
	localizations,
	prepared,
}: {
	localizations: Array<Extract<Awaited<ReturnType<typeof writeWebsiteLayoutLocalization>>, { status: "valid" }>>;
	prepared: PreparedWebsiteLayoutGeneration;
}) => {
	"use step";

	const generated = {
		byLocale: Object.fromEntries(localizations.map(({ fields, locale }) => [locale, fields])),
		defaultLocale: prepared.preparation.localizations.defaultLocale,
	} satisfies WebsiteLocalizations<Array<{ path: string; value: string }>>;

	const section = materializeWebsiteLayoutGeneration({ generated, preparation: prepared.preparation });

	await emitWebsiteSectionEvent({
		content: section.content,
		section: section.section,
		slotKey: prepared.preparation.slot.slotKey,
		target: section.target,
	});

	return section;
};

writeWebsiteLayoutGeneration.maxRetries = 3;

export const resolveWebsiteLayoutGenerationMedia = async ({
	prepared,
}: {
	prepared: PreparedWebsiteLayoutGeneration;
}) => {
	"use step";

	const resolved = await settleWebsiteAssetIntents({
		brandColors: prepared.preparation.snapshot.brand.colors,
		brief: prepared.brief,
		fallbackAssets: Object.values(prepared.existingAssetBindings),
		intents: prepared.preparation.assetIntents,
	});

	await emitWebsiteAssetEvents(resolved.assets);

	return resolved.assetBindings;
};

resolveWebsiteLayoutGenerationMedia.maxRetries = WEBSITE_LAYOUT_GENERATION_MAX_RETRIES;

export const assembleWebsiteLayoutGenerationStep = async ({
	assetBindings,
	prepared,
	section,
}: {
	assetBindings: WebsiteAssetBindings;
	prepared: PreparedWebsiteLayoutGeneration;
	section: ReturnType<typeof materializeWebsiteLayoutGeneration>;
}) => {
	"use step";

	return {
		site: createPersistedWebsiteSite(
			assembleWebsiteLayoutGeneration({
				assetBindings,
				existingAssetBindings: prepared.existingAssetBindings,
				preparation: prepared.preparation,
				section,
			})
		),
	};
};

assembleWebsiteLayoutGenerationStep.maxRetries = WEBSITE_LAYOUT_GENERATION_MAX_RETRIES;
