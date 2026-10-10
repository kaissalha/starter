import { beforeEach, describe, expect, it, vi } from "vitest";

const steps = vi.hoisted(() => ({
	applyEnrichment: vi.fn(),
	chunkContent: vi.fn(),
	classifyDocument: vi.fn(),
	classifyImage: vi.fn(),
	extractDocumentText: vi.fn(),
	loadIngestFile: vi.fn(),
	markFailed: vi.fn(),
}));

const knowledge = vi.hoisted(() => ({ deleteKnowledgeFile: vi.fn(), upsertKnowledgeChunks: vi.fn() }));

const storage = vi.hoisted(() => ({ createRun: vi.fn(), setFileRagStatus: vi.fn() }));

vi.mock("../../src/workflows/ingest-file/steps", () => steps);

vi.mock("../../src/ai/knowledge", () => knowledge);

vi.mock("../../src/services/storage", () => ({
	FILE_PROCESSING_FAILED_CODE: "PROCESSING_FAILED",
	setFileRagStatus: storage.setFileRagStatus,
}));

vi.mock("../../src/ai", () => ({ mastra: { getWorkflow: () => ({ createRun: storage.createRun }) } }));

import { MAX_INGEST_TEXT_LENGTH } from "@starter/documents";

import { ingestFileWorkflow, startIngestFile } from "../../src/workflows/ingest-file";

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
		steps.classifyDocument.mockResolvedValue(classification);

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
		expect(steps.classifyDocument).not.toHaveBeenCalled();
		expect(knowledge.upsertKnowledgeChunks).not.toHaveBeenCalled();
		expect(steps.markFailed).toHaveBeenCalledWith(
			expect.objectContaining({ cause: "Document exceeds the ingestion text limit" })
		);
	});

	it("limits concurrent embedding batches to three", async () => {
		steps.chunkContent.mockResolvedValue(
			Array.from({ length: 121 }, (_, chunkIndex) => ({ chunkIndex, content: "Chunk", metadata: {} }))
		);
		const groups = Array.from({ length: 3 }, () => Promise.withResolvers<number>());
		knowledge.upsertKnowledgeChunks.mockImplementation(
			() => groups[Math.floor((knowledge.upsertKnowledgeChunks.mock.calls.length - 1) / 3)]?.promise
		);
		const pending = runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" });
		await vi.waitFor(() => expect(knowledge.upsertKnowledgeChunks).toHaveBeenCalledTimes(3));
		groups[0]?.resolve(20);
		await vi.waitFor(() => expect(knowledge.upsertKnowledgeChunks).toHaveBeenCalledTimes(6));
		groups[1]?.resolve(20);
		await vi.waitFor(() => expect(knowledge.upsertKnowledgeChunks).toHaveBeenCalledTimes(7));
		groups[2]?.resolve(1);
		await pending;
		expect(storage.setFileRagStatus).toHaveBeenCalledOnce();
	});

	it("stops dispatching after a failed batch and waits for active writes before cleanup", async () => {
		steps.chunkContent.mockResolvedValue(
			Array.from({ length: 81 }, (_, chunkIndex) => ({ chunkIndex, content: "Chunk", metadata: {} }))
		);
		const indexing = Promise.withResolvers<number>();
		knowledge.upsertKnowledgeChunks
			.mockRejectedValueOnce(new Error("embedding failed"))
			.mockReturnValueOnce(indexing.promise);
		const pending = runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" });
		await vi.waitFor(() => expect(knowledge.upsertKnowledgeChunks).toHaveBeenCalledTimes(3));
		expect(knowledge.deleteKnowledgeFile).toHaveBeenCalledOnce();
		indexing.resolve(20);
		await expect(pending).rejects.toThrow("embedding failed");
		expect(knowledge.upsertKnowledgeChunks).toHaveBeenCalledTimes(3);
		expect(knowledge.deleteKnowledgeFile).toHaveBeenCalledTimes(2);
		expect(storage.setFileRagStatus).not.toHaveBeenCalled();
	});

	it("classifies text, replaces chunks in bounded batches, and marks the file ready", async () => {
		await runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" });

		expect(steps.classifyDocument).toHaveBeenCalledWith({ text: "Source text" });
		expect(steps.applyEnrichment).toHaveBeenCalledWith({
			classification,
			fileId: "file-1",
			organizationId: "org-1",
		});

		expect(knowledge.deleteKnowledgeFile).toHaveBeenCalledBefore(knowledge.upsertKnowledgeChunks);
		expect(knowledge.upsertKnowledgeChunks).toHaveBeenCalledTimes(3);
		expect(knowledge.upsertKnowledgeChunks.mock.calls.map(([input]) => input.chunks.length)).toEqual([20, 20, 1]);
		expect(storage.setFileRagStatus).toHaveBeenCalledAfter(knowledge.upsertKnowledgeChunks);
		expect(storage.setFileRagStatus).toHaveBeenCalledWith({
			fileId: "file-1",
			organizationId: "org-1",
			status: "ready",
		});
	});
	it("passes extracted PDF pages to chunking while classifying the full text", async () => {
		const source = { pages: [{ pageNumber: 2, text: "Second page" }], text: "Second page" };
		steps.loadIngestFile.mockResolvedValue({ ...file, kind: "document", storageKey: "org-1/knowledge/brief.pdf" });
		steps.extractDocumentText.mockResolvedValue(source);
		await runIngest({ fileId: "file-1", organizationId: "org-1" });
		expect(steps.classifyDocument).toHaveBeenCalledWith({ text: source.text });
		expect(steps.chunkContent).toHaveBeenCalledWith({ ...source, contentType: file.contentType });
	});

	it("enriches images without creating text chunks", async () => {
		steps.loadIngestFile.mockResolvedValue({ ...file, contentType: "image/png", kind: "image" });
		steps.classifyImage.mockResolvedValue(classification);

		await runIngest({ fileId: "file-1", organizationId: "org-1" });

		expect(steps.classifyImage).toHaveBeenCalledWith({
			file: { ...file, contentType: "image/png", kind: "image" },
		});
		expect(knowledge.deleteKnowledgeFile).not.toHaveBeenCalled();
		expect(storage.setFileRagStatus).toHaveBeenCalledOnce();
	});

	it("indexes while enrichment is pending, but waits for both before readiness", async () => {
		const enrichment = Promise.withResolvers<typeof classification>();
		steps.classifyDocument.mockReturnValueOnce(enrichment.promise);
		const pending = runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" });
		await vi.waitFor(() => expect(knowledge.upsertKnowledgeChunks).toHaveBeenCalledTimes(3));
		expect(storage.setFileRagStatus).not.toHaveBeenCalled();
		enrichment.resolve(classification);
		await pending;
		expect(storage.setFileRagStatus).toHaveBeenCalledAfter(steps.applyEnrichment);
	});

	it("waits for in-flight vector writes before cleaning up failed enrichment", async () => {
		const indexing = Promise.withResolvers<number>();
		knowledge.upsertKnowledgeChunks.mockReturnValueOnce(indexing.promise);
		steps.classifyDocument.mockRejectedValueOnce(new Error("enrichment failed"));
		const pending = runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" });
		await vi.waitFor(() => expect(knowledge.upsertKnowledgeChunks).toHaveBeenCalledTimes(3));
		expect(knowledge.deleteKnowledgeFile).toHaveBeenCalledOnce();
		expect(steps.markFailed).not.toHaveBeenCalled();
		indexing.resolve(20);
		await expect(pending).rejects.toThrow("enrichment failed");
		expect(knowledge.deleteKnowledgeFile).toHaveBeenCalledTimes(2);
		expect(storage.setFileRagStatus).not.toHaveBeenCalled();
	});

	it("returns quietly when the organization-scoped file no longer exists", async () => {
		steps.loadIngestFile.mockResolvedValue(null);

		await expect(runIngest({ fileId: "missing", organizationId: "org-1" })).resolves.toMatchObject({
			result: { status: "missing" },
			status: "success",
		});
		expect(storage.setFileRagStatus).not.toHaveBeenCalled();
	});

	it("records a safe failure state and rethrows the workflow error", async () => {
		steps.classifyDocument.mockRejectedValue(new Error("classification failed"));

		await expect(runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" })).rejects.toThrow(
			"classification failed"
		);

		expect(steps.markFailed).toHaveBeenCalledWith({
			cause: "classification failed",
			fileId: "file-1",
			organizationId: "org-1",
		});
		expect(knowledge.deleteKnowledgeFile).toHaveBeenCalledWith({ fileId: "file-1", organizationId: "org-1" });
	});

	it("keeps failed partial chunks hidden and records cleanup failures", async () => {
		knowledge.upsertKnowledgeChunks.mockRejectedValueOnce(new Error("embedding failed"));
		knowledge.deleteKnowledgeFile
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("database unavailable"));

		await expect(runIngest({ fileId: "file-1", organizationId: "org-1", text: "Source text" })).rejects.toThrow(
			"embedding failed"
		);

		expect(storage.setFileRagStatus).not.toHaveBeenCalled();
		expect(steps.markFailed).toHaveBeenCalledWith({
			cause: "embedding failed; vector cleanup failed: database unavailable",
			fileId: "file-1",
			organizationId: "org-1",
		});
	});

	it("marks the file failed when the ingestion run cannot be created", async () => {
		storage.createRun.mockRejectedValueOnce(new Error("workflow unavailable"));

		await expect(startIngestFile({ fileId: "file-1", organizationId: "org-1" })).rejects.toThrow(
			"workflow unavailable"
		);
		expect(storage.setFileRagStatus).toHaveBeenCalledWith({
			error: "PROCESSING_FAILED",
			fileId: "file-1",
			organizationId: "org-1",
			status: "failed",
		});
	});
});
