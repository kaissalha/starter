import "zod/compile";

import {
	bindWebsiteWorkflow,
	markWebsiteWorkflowFailed,
	saveWebsiteWorkflow,
	translateWebsiteContent,
	translateWebsiteLinks,
	type WebsiteTranslationWorkflowInput,
} from "./steps";

export const translateWebsiteWorkflow = async (input: WebsiteTranslationWorkflowInput) => {
	"use workflow";

	try {
		await bindWebsiteWorkflow({ ...input, kind: "translation" });
		const site = await translateWebsiteContent(input);
		await translateWebsiteLinks(input);
		await saveWebsiteWorkflow({ organizationId: input.organizationId, site, websiteId: input.websiteId });
	} catch (error) {
		await markWebsiteWorkflowFailed({
			code: "TRANSLATION_FAILED",
			errorMessage: error instanceof Error ? error.message : "Translation failed",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		});
		throw error;
	}
};
