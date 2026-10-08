import {
	completeBlogDraft,
	failBlogDraft,
	generateBlogDraft,
	prepareInitialBlogDraft,
	type BlogGenerationInput,
} from "./steps";

export const generateBlogPostWorkflow = async (input: BlogGenerationInput) => {
	"use workflow";

	if (input.initialDraft && !(await prepareInitialBlogDraft(input))) {
		return;
	}

	try {
		const document = await generateBlogDraft(input);

		if (document) {
			await completeBlogDraft({ document, input });
		}
	} catch (error) {
		await failBlogDraft(input, error instanceof Error ? error.message : "Unknown error");
		throw error;
	}
};
