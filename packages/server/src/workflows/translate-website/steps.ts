import { getWorkflowMetadata, FatalError } from "workflow";

import type { Iso6391LanguageCode } from "@starter/infinite-website/contracts";
import { editWebsiteSnapshots } from "@starter/infinite-website/editing";

import { translateLinkPageDocument } from "../../services/link-page-translation";
import { getLinkPage, saveLinkPage } from "../../services/link-pages";
import { requireOrganizationPermission } from "../../services/permissions";
import { prepareWebsiteLanguage } from "../../services/websites/languages";
import { getWebsiteWorkflowContext } from "../../services/websites/service";

export { bindWebsiteWorkflow, markWebsiteWorkflowFailed, saveWebsiteWorkflow } from "../website-steps";

export type WebsiteTranslationWorkflowInput = {
	expectedRunId: string | null;
	expectedUpdatedAt: string;
	locale: Iso6391LanguageCode;
	organizationId: string;
	userId: string;
	websiteId: string;
};

export const translateWebsiteContent = async (input: WebsiteTranslationWorkflowInput) => {
	"use step";
	await requireOrganizationPermission({
		organizationId: input.organizationId,
		permission: "write",
		userId: input.userId,
	});
	const { workflowRunId } = getWorkflowMetadata();
	const context = await getWebsiteWorkflowContext({ ...input, workflowRunId });

	if (!context) {
		throw new FatalError("Translation no longer owns the website");
	}

	if (context.site.document.locales.includes(input.locale)) {
		return context.site;
	}

	const edit = await prepareWebsiteLanguage({
		input: { locale: input.locale, operation: "add-language" },
		snapshot: context.site,
	});

	const translated = editWebsiteSnapshots({ inputs: [edit], snapshot: context.site });

	return { ...context.site, ...translated };
};

translateWebsiteContent.maxRetries = 2;

export const translateWebsiteLinks = async (input: WebsiteTranslationWorkflowInput) => {
	"use step";
	const { workflowRunId } = getWorkflowMetadata();
	const context = await getWebsiteWorkflowContext({ ...input, workflowRunId });

	if (!context) {
		throw new FatalError("Translation no longer owns the website");
	}

	const state = await getLinkPage({ organizationId: input.organizationId });

	const document = await translateLinkPageDocument({
		document: state.document,
		locale: input.locale,
		sourceLocale: context.site.document.defaultLocale,
	});

	await saveLinkPage({
		document,
		organizationId: input.organizationId,
		updatedAt: state.updatedAt,
		userId: input.userId,
	});
};

translateWebsiteLinks.maxRetries = 2;
