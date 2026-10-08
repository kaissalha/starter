import { sleep } from "workflow";
import { start } from "workflow/api";

import { websiteGenerationLocales } from "@starter/infinite-website/generation";

import "zod/compile";

import { generateBlogPostWorkflow } from "../generate-blog-post";
import {
	assembleWebsite,
	bindWebsiteWorkflow,
	markWebsiteWorkflowFailed,
	prepareWebsite,
	recordWebsiteGenerationTimeline,
	resolveWebsiteMedia,
	saveWebsiteWorkflow,
	selectWebsiteBrand,
	settleWebsiteMedia,
	skipWebsiteSection,
	writeWebsitePlan,
	writeWebsiteSection,
	type WebsiteGenerationTimeline,
	type WebsiteWorkflowInput,
} from "./steps";

type WebsitePreparation = Awaited<ReturnType<typeof prepareWebsite>>;

type WebsiteGenerationSlot = WebsitePreparation["generationSlots"][number];

type SkippedWebsiteSection = { kind: "skipped"; sectionId: string };

const settleOptional = async <Result>({
	generationSlot,
	operation,
	preparation,
}: {
	generationSlot: WebsiteGenerationSlot;
	operation: () => Promise<Result>;
	preparation: WebsitePreparation;
}): Promise<Result | SkippedWebsiteSection> => {
	try {
		return await operation();
	} catch (error) {
		if (generationSlot.slot.required) {
			throw error;
		}

		const sectionId = await skipWebsiteSection({ generationSlot, preparation });

		return { kind: "skipped", sectionId };
	}
};

const generateWebsiteDraft = async ({
	input,
	mark,
	timeline,
}: {
	input: WebsiteWorkflowInput;
	mark: (stage: string) => void;
	timeline: WebsiteGenerationTimeline;
}) => {
	const templateId = input.templateId ?? "custom";
	const brandSelection = selectWebsiteBrand(input);

	const planSelection = Promise.all(
		websiteGenerationLocales.map(async (locale) => {
			const generated = await writeWebsitePlan({ input, locale });

			if (generated.status === "valid") {
				return generated;
			}

			const repaired = await writeWebsitePlan({ input, locale, repair: generated });

			if (repaired.status !== "valid") {
				throw new Error(`Website plan repair failed for "${locale}": ${repaired.validationError}`);
			}

			return repaired;
		})
	);

	const brand = await brandSelection;
	mark("brandSelected");
	const mediaResolution = resolveWebsiteMedia({ brand, input, templateId });
	const plans = await planSelection;
	mark("plansWritten");

	const preparation = await prepareWebsite({ brand, input, plans, templateId });
	mark("prepared");
	const settledMedia = (async () => settleWebsiteMedia({ resolved: await mediaResolution }))();

	const results = await Promise.all(
		preparation.generationSlots.map((generationSlot) =>
			settleOptional({
				generationSlot,
				operation: async () => ({
					kind: "section" as const,
					section: await writeWebsiteSection({ generationSlot, input, preparation }),
				}),
				preparation,
			})
		)
	);

	mark("sectionsWritten");
	const sections = results.flatMap((result) => (result.kind === "section" ? [result.section] : []));
	const skippedSectionIds = results.flatMap((result) => (result.kind === "skipped" ? [result.sectionId] : []));

	const assetBindings = await settledMedia;
	mark("mediaSettled");
	timeline.counts = {
		locales: websiteGenerationLocales.length,
		modelCalls:
			preparation.generationSlots.filter(({ promptSlot }) => promptSlot.fields.length > 0).length *
			websiteGenerationLocales.length,
		sections: preparation.generationSlots.length,
		skippedSections: skippedSectionIds.length,
	};

	const assembled = await assembleWebsite({ assetBindings, preparation, sections, skippedSectionIds });
	mark("assembled");

	return assembled;
};

export const generateWebsiteWorkflow = async (input: WebsiteWorkflowInput) => {
	"use workflow";

	const startedAt = Date.now();

	const timeline: WebsiteGenerationTimeline = {
		counts: {},
		kind: input.templateId ? "template-change" : "generation",
		organizationId: input.organizationId,
		outcome: "completed",
		stages: {},
		websiteId: input.websiteId,
	};

	const mark = (stage: string) => {
		timeline.stages[stage] = Date.now() - startedAt;
	};

	try {
		if (input.templateId && input.expectedUpdatedAt) {
			await bindWebsiteWorkflow({
				brief: input.brief,
				expectedRunId: input.expectedRunId,
				expectedUpdatedAt: input.expectedUpdatedAt,
				kind: "template-change",
				organizationId: input.organizationId,
				websiteId: input.websiteId,
			});
		} else {
			await bindWebsiteWorkflow({
				brief: input.brief,
				expectedRunId: input.expectedRunId,
				kind: "generation",
				organizationId: input.organizationId,
				websiteId: input.websiteId,
			});
		}

		mark("bound");

		const generated = await Promise.race([
			generateWebsiteDraft({ input, mark, timeline }),
			(async () => {
				await sleep("5m");
				throw new Error("Website generation timed out after 5 minutes");
			})(),
		]);

		await saveWebsiteWorkflow({ organizationId: input.organizationId, websiteId: input.websiteId, ...generated });
		mark("saved");
	} catch (error) {
		mark("failed");
		await recordWebsiteGenerationTimeline({ ...timeline, outcome: "failed" });
		await markWebsiteWorkflowFailed({
			code: "GENERATION_FAILED",
			errorMessage: error instanceof Error ? error.message : "Unknown error",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});

		throw error;
	}

	await recordWebsiteGenerationTimeline(timeline);

	if (!input.templateId) {
		await start(generateBlogPostWorkflow, [
			{
				initialDraft: true,
				instructions:
					"Write a useful introductory article for this business’s audience, grounded in the business brief. Do not invent claims, testimonials, or statistics.",
				organizationId: input.organizationId,
				postId: input.websiteId,
				token: input.websiteId,
				topic: input.brief.type,
			},
		]);
	}
};
