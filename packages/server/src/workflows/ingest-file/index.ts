import { createStep, createWorkflow } from "@mastra/core/workflows";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";

import { MAX_INGEST_TEXT_LENGTH } from "@starter/documents";
import { log, serializeLogError } from "@starter/observability";

import { classifyDocument, classifyImage, clearChunks, embedAndInsertChunks } from "./mastra-steps";
import { applyEnrichment, chunkContent, extractDocumentText, loadIngestFile, markFailed, markReady } from "./steps";

const EMBED_BATCH_SIZE = 20;

const EMBED_BATCH_CONCURRENCY = 3;

export const ingestFileWorkflowId = "ingest-file";

const ingestInputSchema = z.object({
	fileId: z.string().min(1),
	organizationId: z.string().min(1),
	text: z.string().optional(),
});

const ingestSourceSchema = z.object({
	file: z
		.object({
			access: z.enum(["public", "private"]),
			contentType: z.string(),
			kind: z.enum(["audio", "document", "image", "other", "text", "video"]),
			name: z.string(),
			source: z.string().nullable(),
			storageKey: z.string().nullable(),
		})
		.nullable(),
	fileId: z.string(),
	organizationId: z.string(),
	pages: z.array(z.object({ pageNumber: z.number(), text: z.string() })),
	text: z.string(),
});

const stepOutcomeSchema = z.object({ error: z.string().nullable() });

const serializedErrorSchema = z.looseObject({ message: z.string() });

const failureMessage = (failure: { message?: string } | undefined, fallback: string) => failure?.message ?? fallback;

const settleStep = async (task: () => Promise<void>) => {
	try {
		await task();

		return { error: null };
	} catch (error) {
		return { error: failureMessage(serializedErrorSchema.safeParse(error).data, "Failed to process file") };
	}
};

const prepareSourceStep = createStep({
	execute: async ({ inputData: { fileId, organizationId, text } }) => {
		const file = await loadIngestFile(fileId, organizationId);
		const base = { file, fileId, organizationId, pages: [] };

		if (!file) {
			return { ...base, text: "" };
		}

		const source = await (async () => {
			if (text?.trim()) {
				return { pages: [], text };
			}

			if (file.kind === "document" || file.kind === "text") {
				return extractDocumentText(file);
			}

			return { pages: [], text: "" };
		})();

		if (source.text.length > MAX_INGEST_TEXT_LENGTH) {
			throw new Error("Document exceeds the ingestion text limit");
		}

		return { ...base, ...source };
	},
	id: "prepare-source",
	inputSchema: ingestInputSchema,
	outputSchema: ingestSourceSchema,
});

const enrichFileStep = createStep({
	execute: ({ inputData: { file, fileId, organizationId, text } }) =>
		settleStep(async () => {
			if (!file) {
				return;
			}

			if (!text.trim() && file.kind !== "image") {
				return;
			}

			const classification = text.trim()
				? await classifyDocument({ organizationId, text })
				: await classifyImage({ file, organizationId });

			await applyEnrichment({ classification, fileId, organizationId });
		}),
	id: "enrich-file",
	inputSchema: ingestSourceSchema,
	outputSchema: stepOutcomeSchema,
});

const indexChunksStep = createStep({
	execute: ({ inputData: { file, fileId, organizationId, pages, text } }) =>
		settleStep(async () => {
			if (!file || !text.trim()) {
				return;
			}

			await clearChunks({ fileId, organizationId });
			const chunks = await chunkContent({ contentType: file.contentType, pages, text });

			const batches = Array.from({ length: Math.ceil(chunks.length / EMBED_BATCH_SIZE) }, (_, index) =>
				chunks.slice(index * EMBED_BATCH_SIZE, (index + 1) * EMBED_BATCH_SIZE)
			);

			while (batches.length > 0) {
				const batchResults = await Promise.allSettled(
					batches.splice(0, EMBED_BATCH_CONCURRENCY).map((chunkBatch) =>
						embedAndInsertChunks({
							chunks: chunkBatch,
							fileId,
							fileName: file.name,
							organizationId,
							source: file.source,
						})
					)
				);

				const failedBatch = batchResults.find((result) => result.status === "rejected");

				if (failedBatch?.status === "rejected") {
					throw failedBatch.reason;
				}
			}
		}),
	id: "index-chunks",
	inputSchema: ingestSourceSchema,
	outputSchema: stepOutcomeSchema,
});

const markReadyStep = createStep({
	execute: async ({ getStepResult, inputData }) => {
		const failure = inputData["enrich-file"].error ?? inputData["index-chunks"].error;

		if (failure) {
			throw new Error(failure);
		}

		const { file, fileId, organizationId } = getStepResult(prepareSourceStep);

		if (!file) {
			return { status: "missing" as const };
		}

		await markReady({ fileId, organizationId });

		return { status: "ready" as const };
	},
	id: "mark-ready",
	inputSchema: z.object({ "enrich-file": stepOutcomeSchema, "index-chunks": stepOutcomeSchema }),
	outputSchema: z.object({ status: z.enum(["missing", "ready"]) }),
});

const recordIngestFailure = async ({ error, input }: { error?: { message?: string }; input: unknown }) => {
	const parsed = ingestInputSchema.safeParse(input);

	if (!parsed.success) {
		return;
	}

	const { fileId, organizationId } = parsed.data;
	const primaryFailure = failureMessage(error, "Failed to process file");

	const cleanupFailure = await (async () => {
		try {
			await clearChunks({ fileId, organizationId });

			return undefined;
		} catch (cleanupError) {
			return failureMessage(serializedErrorSchema.safeParse(cleanupError).data, "unknown cleanup error");
		}
	})();

	await markFailed({
		cause: cleanupFailure ? `${primaryFailure}; vector cleanup failed: ${cleanupFailure}` : primaryFailure,
		fileId,
		organizationId,
	});
};

/* oxlint-disable promise/prefer-await-to-then, github/no-then, unicorn/prefer-top-level-await -- Mastra's workflow builder chains steps with .then(); it is not a Promise. */
export const ingestFileWorkflow = createWorkflow({
	description: "Extracts, classifies, chunks and embeds an uploaded or written file for knowledge retrieval.",
	id: ingestFileWorkflowId,
	inputSchema: ingestInputSchema,
	options: {
		onError: ({ error, getInitData }) => recordIngestFailure({ error, input: getInitData() }),
	},
	outputSchema: z.object({ status: z.enum(["missing", "ready"]) }),
})
	.then(prepareSourceStep)
	.parallel([enrichFileStep, indexChunksStep])
	.then(markReadyStep)
	.commit();
/* oxlint-enable promise/prefer-await-to-then, github/no-then, unicorn/prefer-top-level-await */

export const startIngestFile = async (input: z.infer<typeof ingestInputSchema>) => {
	const { mastra } = await import("../../mastra");
	const run = await mastra.getWorkflow("ingestFileWorkflow").createRun({ resourceId: input.organizationId });

	const execute = async () => {
		try {
			await run.start({ inputData: input });
		} catch (error) {
			await log.error({
				error: serializeLogError(error),
				message: "File ingestion run crashed",
				runId: run.runId,
			});
		}
	};

	waitUntil(execute());

	return { runId: run.runId };
};
