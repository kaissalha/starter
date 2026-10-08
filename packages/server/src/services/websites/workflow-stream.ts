import { streamToEventIterator } from "@orpc/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { getRun } from "workflow/api";

import { db, websites, type WebsiteRecord } from "@starter/db";
import { websiteGenerationEventSchema, type WebsiteGenerationEnvelopeV1 } from "@starter/infinite-website/contracts";

import {
	getWebsiteRecord,
	getWebsiteVersionRecord,
	inferWebsiteWorkflowKind,
	isWebsiteWorkflowCompletionRecoverable,
} from "./persistence";
import { projectWebsiteSnapshot, readPersistedWebsiteSite } from "./persistence-read";

const workflowFailureCodes = {
	generation: "GENERATION_FAILED",
	"layout-generation": "LAYOUT_GENERATION_FAILED",
	"section-addition": "SECTION_ADDITION_FAILED",
	translation: "TRANSLATION_FAILED",
} as const;

export const cancelWebsiteWorkflowRun = async ({
	cancelReason = "Website workflow lost resource ownership",
	runId,
}: {
	cancelReason?: string;
	runId: string;
}) => {
	try {
		const run = getRun(runId);

		if (await run.exists) {
			await run.cancel({ cancelReason });
		}
	} catch {}
};

const emitWebsiteWorkflowStream = async ({
	controller,
	record,
	runId,
	startIndex,
}: {
	controller: ReadableStreamDefaultController<WebsiteGenerationEnvelopeV1>;
	record: WebsiteRecord;
	runId: string;
	startIndex: number;
}) => {
	const run = getRun(runId);
	const runExisted = await run.exists;
	const workflowName = runExisted ? await run.workflowName : undefined;
	const cursorReference = { value: startIndex };
	const terminalSeenReference = { value: false };

	if (runExisted) {
		const reader = run.getReadable({ startIndex }).getReader();

		while (true) {
			const result = await reader.read();

			if (result.done) {
				break;
			}

			const event = websiteGenerationEventSchema.parse(result.value);
			terminalSeenReference.value ||= event.type === "completed" || event.type === "failed";
			controller.enqueue({ cursor: String(cursorReference.value), event });
			cursorReference.value += 1;
		}
	}

	if (terminalSeenReference.value) {
		return;
	}

	const latest = (await getWebsiteRecord({ organizationId: record.organizationId, websiteId: record.id })) ?? record;

	const status = (await run.exists) ? await run.status : null;

	if (status === "cancelled") {
		controller.enqueue({
			cursor: String(cursorReference.value),
			event: { eventKey: "cancelled", type: "cancelled", version: 1 },
		});

		return;
	}

	if (latest.workflowRunId !== runId) {
		if (!isWebsiteWorkflowCompletionRecoverable({ record: latest, workflowRunId: runId })) {
			return;
		}

		const version = await getWebsiteVersionRecord({
			versionId: latest.draftVersionId,
			websiteId: latest.id,
		});

		if (!version) {
			return;
		}

		controller.enqueue({
			cursor: String(cursorReference.value),
			event: {
				eventKey: "completed",
				snapshot: projectWebsiteSnapshot({
					site: readPersistedWebsiteSite({ record: version }),
				}),
				type: "completed",
				version: 1,
			},
		});

		return;
	}

	if (status === null || status === "failed" || status === "completed") {
		const kind = inferWebsiteWorkflowKind({ workflowName });

		controller.enqueue({
			cursor: String(cursorReference.value),
			event: {
				code: kind ? workflowFailureCodes[kind] : "WORKFLOW_FAILED",
				eventKey: "failed",
				type: "failed",
				version: 1,
			},
		});
	}
};

export const streamWebsiteWorkflow = ({
	afterCursor,
	record,
	runId,
}: {
	afterCursor?: string;
	record: WebsiteRecord;
	runId: string;
}) => {
	const startIndex = afterCursor ? Number(afterCursor) + 1 : 0;

	const stream = new ReadableStream<WebsiteGenerationEnvelopeV1>({
		start: async (controller) => {
			try {
				await emitWebsiteWorkflowStream({ controller, record, runId, startIndex });
				controller.close();
			} catch (error) {
				controller.error(error);
			}
		},
	});

	return streamToEventIterator(stream);
};

export const releaseWebsiteWorkflowRun = async ({
	organizationId,
	websiteId,
	workflowRunId,
}: {
	organizationId: string;
	websiteId: string;
	workflowRunId: string;
}) => {
	const [released] = await db
		.update(websites)
		.set({ translationLocale: null, workflowRunId: null })
		.where(
			and(
				eq(websites.organizationId, organizationId),
				eq(websites.id, websiteId),
				eq(websites.workflowRunId, workflowRunId),
				isNotNull(websites.draftVersionId)
			)
		)
		.returning({ id: websites.id });

	return Boolean(released);
};

const websiteWorkflowStaleAfterMs = 15 * 60 * 1000;

export const getAttachedWebsiteWorkflowState = async ({ record }: { record: WebsiteRecord }) => {
	if (!record.workflowRunId) {
		return null;
	}

	const run = getRun(record.workflowRunId);

	if (!(await run.exists)) {
		await db
			.update(websites)
			.set({ translationLocale: null, workflowRunId: null })
			.where(and(eq(websites.id, record.id), eq(websites.workflowRunId, record.workflowRunId)));

		return null;
	}

	const [status, workflowName] = await Promise.all([run.status, run.workflowName]);
	const running = status === "pending" || status === "running";
	const stale = Date.now() - Date.parse(record.updatedAt) > websiteWorkflowStaleAfterMs;

	if (running && stale) {
		await cancelWebsiteWorkflowRun({
			cancelReason: "Website workflow exceeded its time limit",
			runId: record.workflowRunId,
		});
	}

	const active = running && !stale;

	if (!active && record.draftVersionId) {
		await releaseWebsiteWorkflowRun({
			organizationId: record.organizationId,
			websiteId: record.id,
			workflowRunId: record.workflowRunId,
		});

		return null;
	}

	const kind = inferWebsiteWorkflowKind({ workflowName });
	const state = active ? ("active" as const) : ("failed" as const);

	if (kind === "translation" && record.translationLocale) {
		return { kind, locale: record.translationLocale, runId: record.workflowRunId, state };
	}

	return !kind || kind === "translation"
		? { kind: "unknown" as const, runId: record.workflowRunId, state: "blocked" as const }
		: { kind, runId: record.workflowRunId, state };
};

export const reconcileWebsiteWorkflow = async ({
	organizationId,
	websiteId,
}: {
	organizationId: string;
	websiteId: string;
}) => {
	const record = await getWebsiteRecord({ organizationId, websiteId });

	if (record?.workflowRunId) {
		await getAttachedWebsiteWorkflowState({ record });
	}
};
