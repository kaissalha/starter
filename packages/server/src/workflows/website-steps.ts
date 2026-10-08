import { FatalError, getWorkflowMetadata, getWritable, RetryableError } from "workflow";

import type { PersistedWebsiteSiteV1, WebsiteGenerationEventV1 } from "@starter/infinite-website/contracts";
import { log } from "@starter/observability";

import {
	claimWebsiteWorkflowRun,
	completeWebsiteWorkflow,
	type WebsiteWorkflowClaim,
} from "../services/websites/service";
import { releaseWebsiteWorkflowRun } from "../services/websites/workflow-stream";

export const throwWebsiteModelError = (error: Error): never => {
	throw new RetryableError(error.message, { retryAfter: "1s" });
};

export const emitWebsiteWorkflowEvents = async ({
	close = false,
	events,
}: {
	close?: boolean;
	events: Array<WebsiteGenerationEventV1>;
}) => {
	const writer = getWritable<WebsiteGenerationEventV1>().getWriter();

	try {
		for (const event of events) {
			await writer.write(event);
		}

		if (close) {
			await writer.close();
		}
	} finally {
		writer.releaseLock();
	}
};

export const emitWebsitePreparedEvents = ({
	slots,
	snapshot,
}: Pick<Extract<WebsiteGenerationEventV1, { type: "prepared" }>, "slots" | "snapshot">) =>
	emitWebsiteWorkflowEvents({
		events: [
			{ eventKey: "status:planning", stage: "planning", type: "status", version: 1 },
			{ eventKey: "prepared", slots, snapshot, type: "prepared", version: 1 },
			{ eventKey: "status:writing", stage: "writing", type: "status", version: 1 },
		],
	});

export const emitWebsiteSectionEvent = (
	section: Pick<Extract<WebsiteGenerationEventV1, { type: "section" }>, "content" | "section" | "slotKey" | "target">
) =>
	emitWebsiteWorkflowEvents({
		events: [{ ...section, eventKey: `section:${section.section.id}`, type: "section", version: 1 }],
	});

export const emitWebsiteAssetEvents = (
	assets: Array<Omit<Extract<WebsiteGenerationEventV1, { type: "asset-settled" }>, "eventKey" | "type" | "version">>
) =>
	emitWebsiteWorkflowEvents({
		events: assets.map(({ asset, assetId, outcome, slotKey }) => ({
			asset,
			assetId,
			eventKey: `asset:${assetId}`,
			outcome,
			slotKey,
			type: "asset-settled",
			version: 1,
		})),
	});

export const bindWebsiteWorkflow = async (claim: WebsiteWorkflowClaim) => {
	"use step";

	const { workflowRunId } = getWorkflowMetadata();
	const record = await claimWebsiteWorkflowRun({ ...claim, runId: workflowRunId });

	if (!record) {
		throw new FatalError(`Website workflow no longer owns this ${claim.kind}`);
	}
};

bindWebsiteWorkflow.maxRetries = 2;

export const saveWebsiteWorkflow = async ({
	organizationId,
	site,
	websiteId,
}: {
	organizationId: string;
	site: PersistedWebsiteSiteV1;
	websiteId: string;
}) => {
	"use step";

	await emitWebsiteWorkflowEvents({
		events: [{ eventKey: "status:saving", stage: "saving", type: "status", version: 1 }],
	});

	const { workflowRunId } = getWorkflowMetadata();
	const completed = await completeWebsiteWorkflow({ organizationId, site, websiteId, workflowRunId });

	if (!completed) {
		throw new FatalError("Website workflow lost ownership before saving");
	}

	await emitWebsiteWorkflowEvents({
		close: true,
		events: [{ eventKey: "completed", snapshot: completed, type: "completed", version: 1 }],
	});
	await log.info({ message: "Website workflow completed", organizationId, websiteId, workflowRunId });
};

saveWebsiteWorkflow.maxRetries = 2;

const websiteFailureLogMessages = {
	GENERATION_FAILED: "Website generation failed",
	LAYOUT_GENERATION_FAILED: "Website layout generation failed",
	SECTION_ADDITION_FAILED: "Website section addition failed",
	TRANSLATION_FAILED: "Website translation failed",
} as const;

export const markWebsiteWorkflowFailed = async ({
	code,
	errorMessage,
	organizationId,
	websiteId,
}: {
	code: keyof typeof websiteFailureLogMessages;
	errorMessage: string;
	organizationId: string;
	websiteId: string;
}) => {
	"use step";

	const { workflowRunId } = getWorkflowMetadata();
	await releaseWebsiteWorkflowRun({ organizationId, websiteId, workflowRunId });

	log.error({
		errorMessage,
		message: websiteFailureLogMessages[code],
		organizationId,
		websiteId,
		workflowRunId,
	});

	await emitWebsiteWorkflowEvents({
		close: true,
		events: [{ code, eventKey: "failed", type: "failed", version: 1 }],
	});
};

markWebsiteWorkflowFailed.maxRetries = 2;
