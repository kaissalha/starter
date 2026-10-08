import { websiteGenerationLocales } from "@starter/infinite-website/generation";

import "zod/compile";

import {
	assembleWebsiteLayoutGenerationStep,
	bindWebsiteWorkflow,
	markWebsiteWorkflowFailed,
	prepareWebsiteLayoutGenerationStep,
	resolveWebsiteLayoutGenerationMedia,
	saveWebsiteWorkflow,
	writeWebsiteLayoutGeneration,
	writeWebsiteLayoutLocalization,
	type WebsiteLayoutGenerationWorkflowInput,
} from "./steps";

type PreparedWebsiteLayoutGeneration = Awaited<ReturnType<typeof prepareWebsiteLayoutGenerationStep>>;

const writeWebsiteLayoutContent = async ({ prepared }: { prepared: PreparedWebsiteLayoutGeneration }) => {
	const localizations =
		prepared.preparation.missingTextPointers.length === 0
			? websiteGenerationLocales.map((locale) => ({ fields: [], locale, status: "valid" as const }))
			: await Promise.all(
					websiteGenerationLocales.map(async (locale) => {
						const generated = await writeWebsiteLayoutLocalization({ locale, prepared });

						if (generated.status === "valid") {
							return generated;
						}

						const repaired = await writeWebsiteLayoutLocalization({ locale, prepared, repair: generated });

						if (repaired.status !== "valid") {
							throw new Error(`Website layout repair failed for "${locale}"`);
						}

						return repaired;
					})
				);

	return writeWebsiteLayoutGeneration({ localizations, prepared });
};

export const generateWebsiteLayoutWorkflow = async (input: WebsiteLayoutGenerationWorkflowInput) => {
	"use workflow";

	try {
		await bindWebsiteWorkflow({
			expectedRunId: input.expectedRunId,
			expectedUpdatedAt: input.expectedUpdatedAt,
			kind: "layout-generation",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		const prepared = await prepareWebsiteLayoutGenerationStep(input);

		const [sectionResult, assetBindingsResult] = await Promise.allSettled([
			writeWebsiteLayoutContent({ prepared }),
			resolveWebsiteLayoutGenerationMedia({ prepared }),
		]);

		if (sectionResult.status === "rejected") {
			throw sectionResult.reason;
		}

		if (assetBindingsResult.status === "rejected") {
			throw assetBindingsResult.reason;
		}

		const generated = await assembleWebsiteLayoutGenerationStep({
			assetBindings: assetBindingsResult.value,
			prepared,
			section: sectionResult.value,
		});

		await saveWebsiteWorkflow({ organizationId: input.organizationId, websiteId: input.websiteId, ...generated });
	} catch (error) {
		await markWebsiteWorkflowFailed({
			code: "LAYOUT_GENERATION_FAILED",
			errorMessage: error instanceof Error ? error.message : "Unknown error",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		throw error;
	}
};
