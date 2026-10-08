import { websiteGenerationLocales } from "@starter/infinite-website/generation";

import "zod/compile";

import {
	assembleWebsiteSectionAdditionStep,
	bindWebsiteWorkflow,
	markWebsiteWorkflowFailed,
	prepareWebsiteSectionAdditionStep,
	resolveWebsiteSectionAdditionMedia,
	saveWebsiteWorkflow,
	writeWebsiteSectionAddition,
	writeWebsiteSectionAdditionLocalization,
	type WebsiteSectionAdditionWorkflowInput,
} from "./steps";

type PreparedWebsiteSectionAddition = Awaited<ReturnType<typeof prepareWebsiteSectionAdditionStep>>;

const writeWebsiteSectionAdditionContent = async ({
	input,
	prepared,
}: {
	input: WebsiteSectionAdditionWorkflowInput;
	prepared: PreparedWebsiteSectionAddition;
}) => {
	const localizations = await Promise.all(
		websiteGenerationLocales.map(async (locale) => {
			const generated = await writeWebsiteSectionAdditionLocalization({ locale, prepared });

			if (generated.status === "valid") {
				return generated;
			}

			const repaired = await writeWebsiteSectionAdditionLocalization({ locale, prepared, repair: generated });

			if (repaired.status !== "valid") {
				throw new Error(`Website section repair failed for "${locale}": ${repaired.validationError}`);
			}

			return repaired;
		})
	);

	return writeWebsiteSectionAddition({ input, localizations, prepared });
};

export const addWebsiteSectionWorkflow = async (input: WebsiteSectionAdditionWorkflowInput) => {
	"use workflow";

	try {
		await bindWebsiteWorkflow({
			expectedRunId: input.expectedRunId,
			expectedUpdatedAt: input.expectedUpdatedAt,
			kind: "section-addition",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		const prepared = await prepareWebsiteSectionAdditionStep(input);

		const [sectionResult, assetBindingsResult] = await Promise.allSettled([
			writeWebsiteSectionAdditionContent({ input, prepared }),
			resolveWebsiteSectionAdditionMedia({ prepared }),
		]);

		if (sectionResult.status === "rejected") {
			throw sectionResult.reason;
		}

		if (assetBindingsResult.status === "rejected") {
			throw assetBindingsResult.reason;
		}

		const generated = await assembleWebsiteSectionAdditionStep({
			assetBindings: assetBindingsResult.value,
			materialized: sectionResult.value,
			prepared,
		});

		await saveWebsiteWorkflow({ organizationId: input.organizationId, websiteId: input.websiteId, ...generated });
	} catch (error) {
		await markWebsiteWorkflowFailed({
			code: "SECTION_ADDITION_FAILED",
			errorMessage: error instanceof Error ? error.message : "Unknown error",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		throw error;
	}
};
