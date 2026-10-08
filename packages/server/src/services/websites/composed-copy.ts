import type { LanguageModel } from "ai";

import { createWebsiteComposedCopyPrompt } from "../../ai/prompts";
import type { ComposeWebsiteSectionToolInput } from "../../ai/website-contracts";
import { createComposedCopySchema, deriveComposedCopySlots, mergeComposedCopy } from "../../ai/website-copy-split";
import { models } from "../../mastra/models";
import { runWebsiteObjectGeneration } from "./generation-model";

export const generateComposedCopy = async ({
	abortSignal,
	evidence,
	input,
	model = models.websiteGeneration.model,
}: {
	abortSignal?: AbortSignal;
	evidence: { facts: Array<string>; requests: Array<string> };
	input: ComposeWebsiteSectionToolInput;
	model?: LanguageModel;
}) => {
	const slots = deriveComposedCopySlots(input);

	const request = {
		abortSignal,
		model,
		prompt: createWebsiteComposedCopyPrompt({ evidence, slots }),
		schema: createComposedCopySchema(slots),
		telemetryFunctionId: "website-composed-copy",
	};

	const first = await runWebsiteObjectGeneration(request);

	const generated =
		first.status === "valid" ? first : await runWebsiteObjectGeneration({ ...request, repair: first });

	return generated.status === "valid" ? mergeComposedCopy({ input, output: generated.output }) : null;
};
