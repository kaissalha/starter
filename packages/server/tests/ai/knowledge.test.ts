import { RequestContext } from "@mastra/core/request-context";
import { noopObserve } from "@mastra/core/tools";
import { ORPCError } from "@orpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const vectorStoreMocks = vi.hoisted(() => ({ deleteVectors: vi.fn(), query: vi.fn(), upsert: vi.fn() }));

const storageMocks = vi.hoisted(() => ({ getFile: vi.fn(), listRetrievableFileIds: vi.fn() }));

const { requireOrganizationPermission } = vi.hoisted(() => ({ requireOrganizationPermission: vi.fn() }));

const { evaluateDecision } = vi.hoisted(() => ({ evaluateDecision: vi.fn() }));

vi.mock("../../src/ai/decisions", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/ai/decisions")>()),
	evaluateDecision,
}));

vi.mock("@mastra/pg", () => ({
	PgVector: class {
		deleteVectors(...args: Array<unknown>) {
			return vectorStoreMocks.deleteVectors(...args);
		}

		query(...args: Array<unknown>) {
			return vectorStoreMocks.query(...args);
		}

		upsert(...args: Array<unknown>) {
			return vectorStoreMocks.upsert(...args);
		}
	},
	PostgresStore: class {},
}));

vi.mock("../../src/services/storage", () => storageMocks);

vi.mock("../../src/services/permissions", () => ({ requireOrganizationPermission }));

import { type KnowledgeRequestContext, retrieveKnowledgeTool, upsertKnowledgeChunks } from "../../src/ai/knowledge";

const organizationId = "organization-1";

const readyFileId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330";

const requestContext = () =>
	new RequestContext<KnowledgeRequestContext>([
		["organizationId", organizationId],
		["userId", "user-1"],
	]);

const execute = (
	input: { fileIds?: Array<string>; queryText: string; rerank?: boolean; topK: number },
	context = requestContext()
) => {
	if (!retrieveKnowledgeTool.execute) {
		throw new Error("Knowledge retrieval tool execute handler is missing");
	}

	return retrieveKnowledgeTool.execute(input, { observe: noopObserve, requestContext: context });
};

const embeddingRequestSchema = z.compile(
	z.looseObject({ dimensions: z.number().optional(), input: z.array(z.string()), model: z.string() })
);

const stubEmbeddingGateway = () => {
	const requestBodies: Array<z.infer<typeof embeddingRequestSchema>> = [];

	vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
		const body = embeddingRequestSchema.parse(
			input instanceof Request ? await input.clone().json() : JSON.parse(String(init?.body))
		);

		requestBodies.push(body);

		return Response.json({
			data: body.input.map((_: string, index: number) => ({ embedding: [index], index, object: "embedding" })),
			model: "google/gemini-embedding-2",
			object: "list",
			usage: { prompt_tokens: 1, total_tokens: 1 },
		});
	});

	return requestBodies;
};

beforeEach(() => {
	vi.clearAllMocks();
	requireOrganizationPermission.mockResolvedValue("member");
	vectorStoreMocks.query.mockResolvedValue([]);
	vectorStoreMocks.upsert.mockResolvedValue([]);
	storageMocks.listRetrievableFileIds.mockResolvedValue([]);
	evaluateDecision.mockResolvedValue(null);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("Mastra knowledge retrieval", () => {
	it("reranks only authorized ready passages and retains every source and vector score", async () => {
		stubEmbeddingGateway();
		storageMocks.listRetrievableFileIds.mockResolvedValue([readyFileId]);
		vectorStoreMocks.query.mockResolvedValue([
			{ id: "background", metadata: { fileId: readyFileId, organizationId, text: "Background" }, score: 0.9 },
			{ id: "foreign", metadata: { organizationId: "other", text: "Private" }, score: 1 },
			{
				id: "contrary",
				metadata: { fileId: readyFileId, organizationId, text: "Contradictory evidence" },
				score: 0.7,
			},
		]);
		evaluateDecision.mockResolvedValueOnce({
			answers: { c0: { score: 1, type: "score" }, c1: { score: 3, type: "score" } },
		});

		const result = await execute({
			fileIds: [readyFileId],
			queryText: "Does the brief support this?",
			rerank: true,
			topK: 3,
		});

		expect(result).toMatchObject({
			sources: [
				{ id: "contrary", score: 0.7 },
				{ id: "background", score: 0.9 },
			],
		});
		expect(result).not.toMatchObject({ suggestion: "widen" });
		expect(JSON.stringify(evaluateDecision.mock.calls[0]?.[0].state)).not.toContain("Private");
		expect(JSON.stringify(evaluateDecision.mock.calls[1]?.[0].state)).not.toContain("Private");
	});
	it("reranks automatically for a narrow score spread and suggests widening uncovered queries", async () => {
		stubEmbeddingGateway();
		storageMocks.listRetrievableFileIds.mockResolvedValue([readyFileId]);
		vectorStoreMocks.query.mockResolvedValue([
			{ id: "a", metadata: { fileId: readyFileId, organizationId, text: "A" }, score: 0.81 },
			{ id: "b", metadata: { fileId: readyFileId, organizationId, text: "B" }, score: 0.8 },
			{ id: "c", metadata: { fileId: readyFileId, organizationId, text: "C" }, score: 0.79 },
		]);
		evaluateDecision
			.mockResolvedValueOnce({
				answers: {
					c0: { score: 0, type: "score" },
					c1: { score: 1, type: "score" },
					c2: { score: 3, type: "score" },
				},
			})
			.mockResolvedValueOnce({ answers: { answersQuery: { probability: 0.1, type: "boolean" } } });
		await expect(execute({ queryText: "which?", topK: 3 })).resolves.toMatchObject({
			sources: [{ id: "c" }, { id: "b" }, { id: "a" }],
			suggestion: "widen",
		});
		expect(evaluateDecision).toHaveBeenCalledTimes(2);
		expect(evaluateDecision.mock.calls[1]?.[0].classifier.id).toBe("knowledge-coverage");
	});
	it("keeps vector order for a wide spread and omits widening at the maximum topK or without a decision", async () => {
		stubEmbeddingGateway();
		storageMocks.listRetrievableFileIds.mockResolvedValue([readyFileId]);
		vectorStoreMocks.query.mockResolvedValue([
			{ id: "a", metadata: { fileId: readyFileId, organizationId, text: "A" }, score: 0.9 },
			{ id: "b", metadata: { fileId: readyFileId, organizationId, text: "B" }, score: 0.6 },
			{ id: "c", metadata: { fileId: readyFileId, organizationId, text: "C" }, score: 0.5 },
		]);
		evaluateDecision.mockResolvedValueOnce({ answers: { answersQuery: { probability: 0.1, type: "boolean" } } });
		const capped = await execute({ queryText: "which?", topK: 20 });
		expect(capped).toMatchObject({ sources: [{ id: "a" }, { id: "b" }, { id: "c" }] });
		expect(capped).not.toMatchObject({ suggestion: "widen" });
		expect(evaluateDecision).toHaveBeenCalledTimes(1);
		expect(await execute({ queryText: "which?", topK: 3 })).not.toMatchObject({ suggestion: "widen" });
	});
	it("retains all source IDs while bounding the total passage text", async () => {
		stubEmbeddingGateway();
		storageMocks.listRetrievableFileIds.mockResolvedValue([readyFileId]);
		vectorStoreMocks.query.mockResolvedValue(
			Array.from({ length: 20 }, (_, index) => ({
				id: `source-${index}`,
				metadata: { fileId: readyFileId, organizationId, text: "x".repeat(6000) },
				score: 1 - index / 100,
			}))
		);
		const result = await execute({ queryText: "brief", topK: 20 });

		if (!result || !("sources" in result)) {
			throw new Error("Expected retrieval sources");
		}

		expect(result.sources).toHaveLength(20);
		expect(result.sources.map(({ id }) => id)).toEqual(Array.from({ length: 20 }, (_, index) => `source-${index}`));
		expect(result.sources.reduce((total, { text }) => total + text.length, 0)).toBe(24_000);
	});
	it("rechecks membership on every retrieval before calling providers or reading documents", async () => {
		const requests = stubEmbeddingGateway();
		const context = requestContext();
		await expect(execute({ queryText: "private documents", topK: 1 }, context)).resolves.toEqual({ sources: [] });
		requireOrganizationPermission.mockRejectedValueOnce(new ORPCError("FORBIDDEN"));
		await expect(execute({ queryText: "private documents", topK: 1 }, context)).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(requireOrganizationPermission).toHaveBeenLastCalledWith({
			organizationId,
			permission: "read",
			userId: "user-1",
		});
		expect(requests).toHaveLength(1);
		expect(vectorStoreMocks.query).toHaveBeenCalledTimes(1);
	});

	it("requires the authenticated user even when the organization context is present", async () => {
		const context = new RequestContext<KnowledgeRequestContext>([["organizationId", organizationId]]);
		await expect(execute({ queryText: "private documents", topK: 1 }, context)).resolves.toMatchObject({
			error: true,
			message: expect.stringContaining("userId"),
		});
		expect(requireOrganizationPermission).not.toHaveBeenCalled();
		expect(vectorStoreMocks.query).not.toHaveBeenCalled();
	});

	it("embeds the query at 1536 dimensions and scopes the vector filter to the organization", async () => {
		const requestBodies = stubEmbeddingGateway();

		await expect(execute({ queryText: "tenant knowledge", topK: 1 })).resolves.toEqual({ sources: [] });

		expect(requestBodies).toEqual([
			expect.objectContaining({
				dimensions: 1536,
				input: ["tenant knowledge"],
				model: "google/gemini-embedding-2",
			}),
		]);
		expect(vectorStoreMocks.query).toHaveBeenCalledWith(
			expect.objectContaining({ filter: { organizationId }, indexName: "knowledge", queryVector: [0], topK: 1 })
		);
	});

	it("surfaces vector store and embedding outages instead of reporting no matches", async () => {
		stubEmbeddingGateway();
		vectorStoreMocks.query.mockRejectedValueOnce(new Error("database unavailable"));
		await expect(execute({ queryText: "tenant knowledge", topK: 1 })).rejects.toThrow("database unavailable");

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("rejected", { status: 400 }))
		);
		await expect(execute({ queryText: "tenant knowledge", topK: 1 })).rejects.toMatchObject({ statusCode: 400 });
	});

	it("restricts explicit attachment retrieval before the vector query", async () => {
		stubEmbeddingGateway();
		storageMocks.listRetrievableFileIds.mockResolvedValue([readyFileId]);

		await execute({ fileIds: [readyFileId], queryText: "attached brief", topK: 2 });

		expect(vectorStoreMocks.query).toHaveBeenCalledWith(
			expect.objectContaining({ filter: { fileId: { $in: [readyFileId] }, organizationId } })
		);
	});

	it("does not fall back to organization-wide retrieval for unavailable requested files", async () => {
		await expect(execute({ fileIds: [readyFileId], queryText: "brief", topK: 2 })).rejects.toThrow("not ready");
		expect(vectorStoreMocks.query).not.toHaveBeenCalled();
	});

	it("fails request-context validation without an organization before querying the shared index", async () => {
		await expect(
			execute({ queryText: "tenant knowledge", topK: 1 }, new RequestContext<KnowledgeRequestContext>())
		).resolves.toMatchObject({
			error: true,
			message: expect.stringContaining("organizationId"),
		});
		expect(vectorStoreMocks.query).not.toHaveBeenCalled();
	});

	it("hides results without a ready organization-owned file", async () => {
		stubEmbeddingGateway();
		storageMocks.listRetrievableFileIds.mockResolvedValue(["file-ready"]);

		const match = (
			id: string,
			metadata: { fileId?: string; fileName?: string; organizationId: string; pageNumber?: number; text: string }
		) => ({ id, metadata, score: 1 });

		vectorStoreMocks.query.mockResolvedValue([
			match("ready", {
				fileId: "file-ready",
				fileName: "a.txt",
				organizationId,
				pageNumber: 3,
				text: "x".repeat(7000),
			}),
			match("pending", { fileId: "file-pending", organizationId, text: "Pending" }),
			match("memory", { organizationId, text: "Migrated memory" }),
			match("foreign", { fileId: "file-ready", organizationId: "organization-2", text: "Foreign" }),
		]);

		await expect(execute({ queryText: "brief", topK: 4 })).resolves.toEqual({
			sources: [
				{
					fileId: "file-ready",
					fileName: "a.txt",
					id: "ready",
					pageNumber: 3,
					score: 1,
					text: "x".repeat(6000),
				},
			],
		});
		expect(storageMocks.listRetrievableFileIds).toHaveBeenCalledWith({
			fileIds: ["file-ready", "file-pending"],
			organizationId,
		});
	});
});

describe("Mastra knowledge indexing", () => {
	const chunk = { chunkIndex: 0, content: "hello", id: "chunk-1", startChar: 0 };

	const index = (chunks: Array<typeof chunk & { pageNumber?: number }>, source: string | null = null) =>
		upsertKnowledgeChunks({ chunks, fileId: "file-1", fileName: "a.txt", organizationId, source });

	it("refuses to index chunks for a missing or deleted file", async () => {
		storageMocks.getFile.mockResolvedValueOnce(null);
		await expect(index([chunk])).rejects.toThrow("File is not available for indexing");

		storageMocks.getFile.mockResolvedValueOnce({ deletedAt: "2026-09-01T00:00:00.000Z", id: "file-1" });
		await expect(index([chunk])).rejects.toThrow("File is not available for indexing");

		expect(vectorStoreMocks.upsert).not.toHaveBeenCalled();
	});

	it("embeds chunks with the shared embedder and stores organization-scoped metadata", async () => {
		const requestBodies = stubEmbeddingGateway();
		storageMocks.getFile.mockResolvedValue({ deletedAt: null, id: "file-1" });

		await index(
			[chunk, { ...chunk, chunkIndex: 1, content: "world", id: "chunk-2", pageNumber: 3, startChar: 6 }],
			"https://example.com/a.txt"
		);

		expect(requestBodies).toEqual([
			expect.objectContaining({
				dimensions: 1536,
				input: ["hello", "world"],
				model: "google/gemini-embedding-2",
			}),
		]);
		expect(vectorStoreMocks.upsert).toHaveBeenCalledWith({
			ids: ["chunk-1", "chunk-2"],
			indexName: "knowledge",
			metadata: [
				{
					chunkIndex: 0,
					fileId: "file-1",
					fileName: "a.txt",
					organizationId,
					source: "https://example.com/a.txt",
					startChar: 0,
					text: "hello",
				},
				{
					chunkIndex: 1,
					fileId: "file-1",
					fileName: "a.txt",
					organizationId,
					pageNumber: 3,
					source: "https://example.com/a.txt",
					startChar: 6,
					text: "world",
				},
			],
			vectors: [[0], [1]],
		});
	});
});
