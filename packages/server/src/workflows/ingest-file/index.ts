import { start } from "workflow/api";

import { MAX_INGEST_TEXT_LENGTH } from "@starter/documents";

import "zod/compile";

import { classifyDocument, classifyImage, clearChunks, embedAndInsertChunks } from "./mastra-steps";
import { applyEnrichment, chunkContent, extractDocumentText, loadIngestFile, markFailed, markReady } from "./steps";

const EMBED_BATCH_SIZE = 20;

const EMBED_BATCH_CONCURRENCY = 3;

type IngestFileInput = {
	fileId: string;
	organizationId: string;
	text?: string;
};

export const ingestFileWorkflow = async ({ fileId, organizationId, text }: IngestFileInput) => {
	"use workflow";

	const file = await loadIngestFile(fileId, organizationId);

	if (!file) {
		return;
	}

	try {
		if (!text?.trim() && file.kind === "image") {
			const classification = await classifyImage({ file, organizationId });
			await applyEnrichment({ classification, fileId, organizationId });
			await markReady({ fileId, organizationId });

			return;
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

		if (!source.text.trim()) {
			await markReady({ fileId, organizationId });

			return;
		}

		const results = await Promise.allSettled([
			(async () => {
				const classification = await classifyDocument({ organizationId, text: source.text });
				await applyEnrichment({ classification, fileId, organizationId });
			})(),
			(async () => {
				await clearChunks({ fileId, organizationId });
				const chunks = await chunkContent(source);

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
			})(),
		]);

		const failure = results.find((result) => result.status === "rejected");

		if (failure?.status === "rejected") {
			throw failure.reason;
		}

		await markReady({ fileId, organizationId });
	} catch (error) {
		const primaryFailure = error instanceof Error ? error.message : "Failed to process file";

		const cleanupFailure = await (async () => {
			try {
				await clearChunks({ fileId, organizationId });

				return undefined;
			} catch (cleanupError) {
				return cleanupError instanceof Error ? cleanupError.message : "unknown cleanup error";
			}
		})();

		const failure = cleanupFailure ? `${primaryFailure}; vector cleanup failed: ${cleanupFailure}` : primaryFailure;

		await markFailed({
			cause: failure,
			fileId,
			organizationId,
		});

		throw error;
	}
};

export const startIngestFile = async (input: IngestFileInput) => {
	const run = await start(ingestFileWorkflow, [input]);

	return { runId: run.runId };
};
