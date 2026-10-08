import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	chunk: vi.fn(),
	downloadBlob: vi.fn(),
	evaluateDecision: vi.fn(),
	fromText: vi.fn(),
	generateText: vi.fn(),
	logError: vi.fn(),
	markFileFailed: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	generateText: mocks.generateText,
}));

vi.mock("../../src/mastra/knowledge", () => ({ deleteKnowledgeFile: vi.fn(), upsertKnowledgeChunks: vi.fn() }));

vi.mock("../../src/ai/decisions", () => ({ evaluateDecision: mocks.evaluateDecision }));

vi.mock("@mastra/rag", () => ({ MDocument: { fromText: mocks.fromText } }));

vi.mock("@starter/observability", () => ({ log: { error: mocks.logError } }));

vi.mock("../../src/lib/blob-storage", () => ({ downloadBlob: mocks.downloadBlob }));

vi.mock("../../src/services/storage", () => ({
	applyFileEnrichment: vi.fn(),
	getFile: vi.fn(),
	markFileFailed: mocks.markFileFailed,
	markFileReady: vi.fn(),
	upsertFileTags: vi.fn(),
}));

import { MAX_INGEST_TEXT_LENGTH } from "@starter/documents";

import { MAX_INGEST_CHUNKS } from "../../src/constants/upload";
import { applyFileEnrichment, upsertFileTags } from "../../src/services/storage";
import { classifyDocument, classifyImage } from "../../src/workflows/ingest-file/mastra-steps";
import { applyEnrichment, chunkContent, extractDocumentText, markFailed } from "../../src/workflows/ingest-file/steps";

const invoiceText = `Invoice 2041 for consulting services rendered in August. ${"Line item details. ".repeat(40)}`;

describe("file ingestion Mastra steps", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.fromText.mockReturnValue({ chunk: mocks.chunk });
	});

	it("rejects oversized text before chunking and excess chunks before embedding", async () => {
		await expect(chunkContent({ text: "a".repeat(MAX_INGEST_TEXT_LENGTH + 1) })).rejects.toThrow(
			"Document exceeds the ingestion text limit"
		);
		expect(mocks.fromText).not.toHaveBeenCalled();

		const chunks = Array.from({ length: MAX_INGEST_CHUNKS }, (_, index) => ({
			id_: `chunk-${index}`,
			metadata: { startIndex: index },
			text: "Chunk",
		}));

		mocks.chunk.mockResolvedValue(chunks);
		await expect(chunkContent({ text: "Source" })).resolves.toHaveLength(MAX_INGEST_CHUNKS);
		mocks.chunk.mockResolvedValue([...chunks, chunks[0]]);
		await expect(chunkContent({ text: "Source" })).rejects.toThrow("Document exceeds the ingestion chunk limit");
	});
	it("chunks PDF pages independently and keeps each page number", async () => {
		mocks.fromText.mockImplementation((text: string) => ({
			chunk: async () => [{ id_: text, metadata: { startIndex: 0 }, text }],
		}));
		await expect(
			chunkContent({
				pages: [
					{ pageNumber: 1, text: "First page" },
					{ pageNumber: 3, text: "Third page" },
				],
				text: "First page\n\nThird page",
			})
		).resolves.toEqual([
			{ chunkIndex: 0, content: "First page", id: "First page", pageNumber: 1, startChar: 0 },
			{ chunkIndex: 1, content: "Third page", id: "Third page", pageNumber: 3, startChar: 0 },
		]);
		expect(mocks.fromText.mock.calls.map(([text]) => text)).toEqual(["First page", "Third page"]);
	});

	it("bounds both document and vision downloads before provider calls", async () => {
		const file = {
			access: "private" as const,
			contentType: "text/plain",
			kind: "text" as const,
			name: "brief.txt",
			source: null,
			url: "https://blob.example.com/brief.txt",
		};

		mocks.downloadBlob.mockResolvedValue({ body: Buffer.from("Private source") });
		await expect(extractDocumentText(file)).resolves.toEqual({ pages: [], text: "Private source" });
		expect(mocks.downloadBlob).toHaveBeenCalledWith({
			access: "private",
			url: file.url,
		});
		mocks.downloadBlob.mockRejectedValueOnce(new Error("File exceeds the ingestion byte limit"));
		await expect(
			classifyImage({
				file: { ...file, contentType: "image/png", kind: "image" },
				organizationId: "organization-1",
			})
		).rejects.toThrow("File exceeds the ingestion byte limit");
		expect(mocks.generateText).not.toHaveBeenCalled();
	});

	it("classifies documents with structured output inside an untrusted boundary", async () => {
		const classification = { date: null, language: "en", summary: "Summary", tags: [], title: "Title" };
		mocks.generateText.mockResolvedValue({ output: classification });
		mocks.evaluateDecision.mockResolvedValue({ answers: { category: { choice: "invoice" } } });

		await expect(classifyDocument({ organizationId: "organization-1", text: invoiceText })).resolves.toEqual({
			...classification,
			documentCategory: "invoice",
			ocrText: null,
		});

		expect(mocks.generateText).toHaveBeenCalledWith(
			expect.objectContaining({ prompt: `<untrusted-document>\n${invoiceText}\n</untrusted-document>` })
		);
		expect(mocks.evaluateDecision).toHaveBeenCalledWith(
			expect.objectContaining({ memoize: true, policy: "background", state: invoiceText })
		);
	});
	it("samples long documents and skips category evaluation for very short text", async () => {
		mocks.evaluateDecision.mockClear();
		mocks.generateText.mockResolvedValue({ output: { summary: "Summary", tags: [], title: "Title" } });
		await expect(classifyDocument({ organizationId: "organization-1", text: "Document" })).resolves.toMatchObject({
			documentCategory: "unknown",
		});
		expect(mocks.evaluateDecision).not.toHaveBeenCalled();
		mocks.evaluateDecision.mockResolvedValue({ answers: { category: { choice: "report" } } });
		const longText = `${"Opening ".repeat(600)}${"Closing ".repeat(300)}`;
		await classifyDocument({ organizationId: "organization-1", text: longText });
		const state = mocks.evaluateDecision.mock.calls[0]?.[0].state;
		expect(state).toContain("[…]");
		expect(state.length).toBeLessThan(4200);
	});
	it("preserves required metadata when optional document labeling is unavailable", async () => {
		mocks.evaluateDecision.mockResolvedValue(null);
		mocks.generateText.mockResolvedValue({ output: { summary: "Summary", tags: ["finance"], title: "Report" } });
		await expect(classifyDocument({ organizationId: "organization-1", text: "Document" })).resolves.toMatchObject({
			documentCategory: "unknown",
			summary: "Summary",
			tags: ["finance"],
			title: "Report",
		});
	});
	it.each([
		["2026-09-01", "2026-09-01"],
		["2024-02-29", "2024-02-29"],
		["2024-02-30", null],
		["2024-03", null],
		["Q3 2025", null],
		["", null],
		[null, null],
		["0000-01-01", null],
		["9999-12-31", null],
		["not a date", null],
	])("persists model date %j as %j", async (date, docDate) => {
		const classification = { date, language: "en", ocrText: null, summary: "Summary", tags: [], title: "Title" };
		await expect(
			applyEnrichment({ classification, fileId: "file-1", organizationId: "organization-1" })
		).resolves.toBe(undefined);
		expect(applyFileEnrichment).toHaveBeenCalledWith(expect.objectContaining({ docDate }));
	});
	it("clamps model-generated text and tags before persistence", async () => {
		await applyEnrichment({
			classification: {
				date: null,
				language: "  en  ",
				ocrText: null,
				summary: "s".repeat(3000),
				tags: Array.from({ length: 8 }, (_, index) => `${index}`.repeat(100)),
				title: "t".repeat(600),
			},
			fileId: "file-1",
			organizationId: "organization-1",
		});
		expect(applyFileEnrichment).toHaveBeenCalledWith(
			expect.objectContaining({ language: "en", summary: "s".repeat(2000), title: "t".repeat(500) })
		);
		expect(upsertFileTags).toHaveBeenCalledWith({
			fileId: "file-1",
			organizationId: "organization-1",
			tags: Array.from({ length: 6 }, (_, index) => `${index}`.repeat(64)),
		});
	});
	it("stores a fixed failure code and logs the raw cause", async () => {
		const cause = "Failed query: select secret params: token";
		await markFailed({ cause, fileId: "file-1", organizationId: "organization-1" });
		expect(mocks.markFileFailed).toHaveBeenCalledWith({
			error: "PROCESSING_FAILED",
			fileId: "file-1",
			organizationId: "organization-1",
		});
		expect(mocks.markFileFailed).not.toHaveBeenCalledWith(expect.objectContaining({ error: cause }));
		expect(mocks.logError).toHaveBeenCalledWith(expect.objectContaining({ cause, fileId: "file-1" }));
	});
});
