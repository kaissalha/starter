import { beforeEach, describe, expect, it, vi } from "vitest";

const steps = vi.hoisted(() => ({
	applyEnrichment: vi.fn(),
	chunkContent: vi.fn(),
	extractDocumentText: vi.fn(),
	loadIngestFile: vi.fn(),
	markFailed: vi.fn(),
	markReady: vi.fn(),
}));

const mastraSteps = vi.hoisted(() => ({
	classifyDocument: vi.fn(),
	classifyImage: vi.fn(),
	clearChunks: vi.fn(),
	embedAndInsertChunks: vi.fn(),
}));

vi.mock("../../src/workflows/ingest-file/steps", () => steps);

vi.mock("../../src/workflows/ingest-file/mastra-steps", () => mastraSteps);

import { MAX_INGEST_TEXT_LENGTH } from "@starter/documents";

import { ingestFileWorkflow } from "../../src/workflows/ingest-file";

const runIngest = async (inputData: { fileId: string; organizationId: string; text?: string }) => {
	const run = await ingestFileWorkflow.createRun();
	const result = await run.start({ inputData });

	if (result.status === "failed") {
		throw result.error;
	}

	return result;
};

const file = {
	access: "private" as const,
	contentType: "text/plain",
	kind: "text" as const,
	name: "brief.txt",
	source: null,
	storageKey: null,
};

const classification = {
	date: null,
	language: "en",
	ocrText: null,
	summary: "A brief",
	tags: ["brief"],
	title: "Brief",
};

describe("file ingestion workflow", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		steps.loadIngestFile.mockResolvedValue(file);
		mastraSteps.classifyDocument.mockResolvedValue(classification);

		steps.chunkContent.mockResolvedValue(
			Array.from({ length: 41 }, (_, chunkIndex) => ({
				chunkIndex,
				content: `Chunk ${chunkIndex}`,
				metadata: {},
			}))
		);
	});

	it("rejects oversized inline source before classification or embedding", async () => {
		await expect(
			runIngest({
				fileId: "file-1",
				organizationId: "org-1",
				text: "a".repeat(MAX_INGEST_TEXT_LENGTH + 1),
			})
		).rejects.toThrow("Document exceeds the ingestion text limit");
		expect(mastraSteps.classifyDocument).not.toHaveBeenCalled();
		expect(mastraSteps.embedAndInsertChunks).not.toHaveBeenCalled();
		expect(steps.markFailed).toHaveBeenCalledWith(
			expect.objectContaining({ cause: "Document exceeds the ingestion text limit" })
		);
	});

	it("limits concurrent embedding batches to three", async () => {
		steps.chunkContent.mockResolvedValue(
			Array.from({ length: 121 }, (_, chunkIndex) => ({ chunkIndex, content: "Chunk", metadata: {} }))
		);
		const groups = Array.from({ length: 3 }, () => Promise.withResolvers<number>());
		mastraSteps.embedAndInsertChunks.mockImplementation(
			() => groups[Math.floor((mastraSteps.embedAndInsertChunks.mock.calls.length - 1) / 3)]?.promise
		);
		const pending = runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" });
		await vi.waitFor(() => expect(mastraSteps.embedAndInsertChunks).toHaveBeenCalledTimes(3));
		groups[0]?.resolve(20);
		await vi.waitFor(() => expect(mastraSteps.embedAndInsertChunks).toHaveBeenCalledTimes(6));
		groups[1]?.resolve(20);
		await vi.waitFor(() => expect(mastraSteps.embedAndInsertChunks).toHaveBeenCalledTimes(7));
		groups[2]?.resolve(1);
		await pending;
		expect(steps.markReady).toHaveBeenCalledOnce();
	});

	it("stops dispatching after a failed batch and waits for active writes before cleanup", async () => {
		steps.chunkContent.mockResolvedValue(
			Array.from({ length: 81 }, (_, chunkIndex) => ({ chunkIndex, content: "Chunk", metadata: {} }))
		);
		const indexing = Promise.withResolvers<number>();
		mastraSteps.embedAndInsertChunks
			.mockRejectedValueOnce(new Error("embedding failed"))
			.mockReturnValueOnce(indexing.promise);
		const pending = runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" });
		await vi.waitFor(() => expect(mastraSteps.embedAndInsertChunks).toHaveBeenCalledTimes(3));
		expect(mastraSteps.clearChunks).toHaveBeenCalledOnce();
		indexing.resolve(20);
		await expect(pending).rejects.toThrow("embedding failed");
		expect(mastraSteps.embedAndInsertChunks).toHaveBeenCalledTimes(3);
		expect(mastraSteps.clearChunks).toHaveBeenCalledTimes(2);
		expect(steps.markReady).not.toHaveBeenCalled();
	});

	it("classifies text, replaces chunks in bounded batches, and marks the file ready", async () => {
		await runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" });

		expect(mastraSteps.classifyDocument).toHaveBeenCalledWith({ organizationId: "org-1", text: "Source text" });
		expect(steps.applyEnrichment).toHaveBeenCalledWith({
			classification,
			fileId: "file-1",
			organizationId: "org-1",
		});

		expect(mastraSteps.clearChunks).toHaveBeenCalledBefore(mastraSteps.embedAndInsertChunks);
		expect(mastraSteps.embedAndInsertChunks).toHaveBeenCalledTimes(3);
		expect(mastraSteps.embedAndInsertChunks.mock.calls.map(([input]) => input.chunks.length)).toEqual([20, 20, 1]);
		expect(steps.markReady).toHaveBeenCalledAfter(mastraSteps.embedAndInsertChunks);
		expect(steps.markReady).toHaveBeenCalledWith({ fileId: "file-1", organizationId: "org-1" });
	});
	it("passes extracted PDF pages to chunking while classifying the full text", async () => {
		const source = { pages: [{ pageNumber: 2, text: "Second page" }], text: "Second page" };
		steps.loadIngestFile.mockResolvedValue({ ...file, kind: "document", storageKey: "org-1/knowledge/brief.pdf" });
		steps.extractDocumentText.mockResolvedValue(source);
		await runIngest({ fileId: "file-1", organizationId: "org-1" });
		expect(mastraSteps.classifyDocument).toHaveBeenCalledWith({ organizationId: "org-1", text: source.text });
		expect(steps.chunkContent).toHaveBeenCalledWith({ ...source, contentType: file.contentType });
	});

	it("enriches images without creating text chunks", async () => {
		steps.loadIngestFile.mockResolvedValue({ ...file, contentType: "image/png", kind: "image" });
		mastraSteps.classifyImage.mockResolvedValue(classification);

		await runIngest({ fileId: "file-1", organizationId: "org-1" });

		expect(mastraSteps.classifyImage).toHaveBeenCalledWith({
			file: { ...file, contentType: "image/png", kind: "image" },
			organizationId: "org-1",
		});
		expect(mastraSteps.clearChunks).not.toHaveBeenCalled();
		expect(steps.markReady).toHaveBeenCalledOnce();
	});

	it("indexes while enrichment is pending, but waits for both before readiness", async () => {
		const enrichment = Promise.withResolvers<typeof classification>();
		mastraSteps.classifyDocument.mockReturnValueOnce(enrichment.promise);
		const pending = runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" });
		await vi.waitFor(() => expect(mastraSteps.embedAndInsertChunks).toHaveBeenCalledTimes(3));
		expect(steps.markReady).not.toHaveBeenCalled();
		enrichment.resolve(classification);
		await pending;
		expect(steps.markReady).toHaveBeenCalledAfter(steps.applyEnrichment);
	});

	it("waits for in-flight vector writes before cleaning up failed enrichment", async () => {
		const indexing = Promise.withResolvers<number>();
		mastraSteps.embedAndInsertChunks.mockReturnValueOnce(indexing.promise);
		mastraSteps.classifyDocument.mockRejectedValueOnce(new Error("enrichment failed"));
		const pending = runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" });
		await vi.waitFor(() => expect(mastraSteps.embedAndInsertChunks).toHaveBeenCalledTimes(3));
		expect(mastraSteps.clearChunks).toHaveBeenCalledOnce();
		expect(steps.markFailed).not.toHaveBeenCalled();
		indexing.resolve(20);
		await expect(pending).rejects.toThrow("enrichment failed");
		expect(mastraSteps.clearChunks).toHaveBeenCalledTimes(2);
		expect(steps.markReady).not.toHaveBeenCalled();
	});

	it("returns quietly when the organization-scoped file no longer exists", async () => {
		steps.loadIngestFile.mockResolvedValue(null);

		await expect(runIngest({ fileId: "missing", organizationId: "org-1" })).resolves.toMatchObject({
			result: { status: "missing" },
			status: "success",
		});
		expect(steps.markReady).not.toHaveBeenCalled();
	});

	it("records a safe failure state and rethrows the workflow error", async () => {
		mastraSteps.classifyDocument.mockRejectedValue(new Error("classification failed"));

		await expect(runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" })).rejects.toThrow(
			"classification failed"
		);

		expect(steps.markFailed).toHaveBeenCalledWith({
			cause: "classification failed",
			fileId: "file-1",
			organizationId: "org-1",
		});
		expect(mastraSteps.clearChunks).toHaveBeenCalledWith({ fileId: "file-1", organizationId: "org-1" });
	});

	it("keeps failed partial chunks hidden and records cleanup failures", async () => {
		mastraSteps.embedAndInsertChunks.mockRejectedValueOnce(new Error("embedding failed"));
		mastraSteps.clearChunks
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("database unavailable"));

		await expect(runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" })).rejects.toThrow(
			"embedding failed"
		);

		expect(steps.markReady).not.toHaveBeenCalled();
		expect(steps.markFailed).toHaveBeenCalledWith({
			cause: "embedding failed; vector cleanup failed: database unavailable",
			fileId: "file-1",
			organizationId: "org-1",
		});
	});
});
