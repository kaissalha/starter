import { start } from "workflow/api";

import type { Iso6391LanguageCode } from "@starter/infinite-website/contracts";
import { WebsiteEditError } from "@starter/infinite-website/editing";
import { log } from "@starter/observability";

import { bindDomainRegistrationRun } from "../services/websites/domain-registrations";
import {
	claimWebsiteWorkflowRun,
	getReplaceableWorkflowRunId,
	getWebsite,
	getWebsiteRecord,
	WebsiteDraftNotFoundError,
	WebsiteGenerationConflictError,
	WebsiteMutationConflictError,
	WebsiteSectionAdditionConflictError,
	type WebsiteWorkflowClaim,
} from "../services/websites/service";
import { cancelWebsiteWorkflowRun } from "../services/websites/workflow-stream";
import { addWebsiteSectionWorkflow } from "./add-website-section";
import type { WebsiteSectionAdditionWorkflowInput } from "./add-website-section/steps";
import { generateWebsiteWorkflow } from "./generate-website";
import { generateWebsiteLayoutWorkflow } from "./generate-website-layout";
import type { WebsiteLayoutGenerationWorkflowInput } from "./generate-website-layout/steps";
import type { WebsiteWorkflowInput } from "./generate-website/steps";
import { registerDomainWorkflow } from "./register-domain";
import { translateWebsiteWorkflow } from "./translate-website";
import type { WebsiteTranslationWorkflowInput } from "./translate-website/steps";

const startWebsiteWorkflowRun = async <Input>({
	claim,
	conflict,
	input,
	workflow,
}: {
	claim: WebsiteWorkflowClaim;
	conflict: () => Error;
	input: Input;
	workflow: (input: Input) => Promise<void>;
}) => {
	const run = await start(workflow, [input]);

	try {
		const bound = await claimWebsiteWorkflowRun({ ...claim, runId: run.runId });

		if (!bound) {
			throw conflict();
		}

		await log.info({
			kind: claim.kind,
			message: "Website workflow started",
			organizationId: claim.organizationId,
			websiteId: claim.websiteId,
			workflowRunId: run.runId,
		});

		return { websiteId: claim.websiteId, workflowRunId: run.runId };
	} catch (error) {
		await cancelWebsiteWorkflowRun({ runId: run.runId });
		throw error;
	}
};

export const startWebsiteGeneration = (input: WebsiteWorkflowInput) =>
	startWebsiteWorkflowRun({
		claim:
			input.templateId !== undefined
				? {
						brief: input.brief,
						expectedRunId: input.expectedRunId,
						expectedUpdatedAt: input.expectedUpdatedAt,
						kind: "template-change",
						organizationId: input.organizationId,
						websiteId: input.websiteId,
					}
				: {
						brief: input.brief,
						expectedRunId: input.expectedRunId,
						kind: "generation",
						organizationId: input.organizationId,
						websiteId: input.websiteId,
					},
		conflict: () => new WebsiteGenerationConflictError(),
		input,
		workflow: generateWebsiteWorkflow,
	});

export const startWebsiteSectionAddition = (input: WebsiteSectionAdditionWorkflowInput) =>
	startWebsiteWorkflowRun({
		claim: {
			expectedRunId: input.expectedRunId,
			expectedUpdatedAt: input.expectedUpdatedAt,
			kind: "section-addition",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		},
		conflict: () => new WebsiteSectionAdditionConflictError(),
		input,
		workflow: addWebsiteSectionWorkflow,
	});

export const startWebsiteLayoutGeneration = (input: WebsiteLayoutGenerationWorkflowInput) =>
	startWebsiteWorkflowRun({
		claim: {
			expectedRunId: input.expectedRunId,
			expectedUpdatedAt: input.expectedUpdatedAt,
			kind: "layout-generation",
			organizationId: input.organizationId,
			websiteId: input.websiteId,
		},
		conflict: () => new WebsiteSectionAdditionConflictError(),
		input,
		workflow: generateWebsiteLayoutWorkflow,
	});

export const startWebsiteTranslation = (input: WebsiteTranslationWorkflowInput) =>
	startWebsiteWorkflowRun({
		claim: { ...input, kind: "translation" },
		conflict: () => new WebsiteGenerationConflictError(),
		input,
		workflow: translateWebsiteWorkflow,
	});

export const startDomainRegistration = async (registrationId: string) => {
	const run = await start(registerDomainWorkflow, [registrationId]);
	await bindDomainRegistrationRun({ registrationId, runId: run.runId });
	await log.info({ message: "Domain registration workflow started", registrationId, workflowRunId: run.runId });
};

export const translateWebsite = async ({
	locale,
	organizationId,
	updatedAt,
	userId,
	websiteId,
}: {
	locale: Iso6391LanguageCode;
	organizationId: string;
	updatedAt: string;
	userId: string;
	websiteId: string;
}) => {
	const record = await getWebsiteRecord({ organizationId, websiteId });
	const website = await getWebsite({ organizationId });

	if (!record || !website?.snapshot || website.id !== websiteId) {
		throw new WebsiteDraftNotFoundError();
	}

	if (record.updatedAt !== updatedAt) {
		throw new WebsiteMutationConflictError();
	}

	if (!website.snapshot.document.locales.includes(locale) && website.snapshot.document.locales.length >= 8) {
		throw new WebsiteEditError();
	}

	await startWebsiteTranslation({
		expectedRunId: await getReplaceableWorkflowRunId({ conflict: new WebsiteGenerationConflictError(), record }),
		expectedUpdatedAt: updatedAt,
		locale,
		organizationId,
		userId,
		websiteId,
	});
	const result = await getWebsite({ organizationId });

	if (!result) {
		throw new WebsiteDraftNotFoundError();
	}

	return result;
};
