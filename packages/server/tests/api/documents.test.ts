import { RPCHandler } from "@orpc/server/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createFile: vi.fn(),
	deleteFile: vi.fn(),
	deleteUploadedMedia: vi.fn(),
	getFile: vi.fn(),
	markFileFailed: vi.fn(),
	resolveSession: vi.fn(),
	setFileIngestRunId: vi.fn(),
	startIngestFile: vi.fn(),
}));

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: vi.fn(async () => "owner"),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

vi.mock("../../src/lib/auth", () => ({ resolveSession: mocks.resolveSession }));

vi.mock("../../src/services/storage", () => ({
	createFile: mocks.createFile,
	deleteFile: mocks.deleteFile,
	getFile: mocks.getFile,
	getFileUrl: async () => null,
	markFileFailed: mocks.markFileFailed,
	setFileIngestRunId: mocks.setFileIngestRunId,
}));

vi.mock("../../src/services/media", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/media")>()),
	deleteUploadedMedia: mocks.deleteUploadedMedia,
}));

vi.mock("../../src/lib/blob-storage", () => ({ uploadBufferToBlob: vi.fn() }));

vi.mock("@starter/documents/extraction", () => ({ isSupportedRagFile: vi.fn() }));

vi.mock("../../src/workflows/ingest-file", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/workflows/ingest-file")>()),
	startIngestFile: mocks.startIngestFile,
}));

import { apiRouter } from "../../src/api/app";

const handler = new RPCHandler(apiRouter);

const organizationId = "organization-1";

const documentId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const now = "2026-08-25T12:00:00.000Z";

const document = {
	access: "public",
	contentType: "text/plain",
	createdAt: now,
	id: documentId,
	kind: "text",
	name: "brief.txt",
	organizationId,
	processingError: null,
	ragStatus: "pending",
	sizeBytes: null,
	sourceType: "text",
	summary: null,
	title: null,
	updatedAt: now,
	url: null,
};

const call = async ({ body, path }: { body?: object; path: string }) => {
	const { matched, response } = await handler.handle(
		new Request(`https://example.com/api/rpc/${path}`, {
			body: body ? JSON.stringify({ json: body }) : undefined,
			headers: body ? { "content-type": "application/json" } : undefined,
			method: body ? "POST" : "GET",
		}),
		{ prefix: "/api/rpc" }
	);

	return { json: response ? await response.json() : null, matched, response };
};

describe("documents RPC boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: organizationId },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});

		mocks.createFile.mockResolvedValue({ created: true, file: document });
		mocks.startIngestFile.mockResolvedValue({ runId: "run-1" });
	});

	it("creates an organization-scoped text document and queues ingestion", async () => {
		const result = await call({
			body: { name: " brief.txt ", source: "https://example.com/source", text: "Source knowledge" },
			path: "documents/create",
		});

		expect(result.matched).toBe(true);
		expect(result.response?.status).toBe(200);
		expect(result.json).toEqual({ json: { document, runId: "run-1" } });

		expect(mocks.createFile).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "text",
				name: "brief.txt",
				organizationId,
				ragStatus: "pending",
				uploadedBy: "user-1",
			})
		);

		expect(mocks.startIngestFile).toHaveBeenCalledWith({
			fileId: documentId,
			organizationId,
			text: "Source knowledge",
		});
		expect(mocks.setFileIngestRunId).toHaveBeenCalledWith({ fileId: documentId, organizationId, runId: "run-1" });
	});

	it("marks the document failed when the workflow cannot start", async () => {
		mocks.startIngestFile.mockRejectedValueOnce(new Error("workflow unavailable"));
		const result = await call({ body: { name: "brief.txt", text: "Source knowledge" }, path: "documents/create" });

		expect(result.response?.status).toBe(500);
		expect(mocks.markFileFailed).toHaveBeenCalledWith(
			expect.objectContaining({ fileId: documentId, organizationId })
		);
		expect(mocks.setFileIngestRunId).not.toHaveBeenCalled();
	});

	it("returns a fixed processing failure code instead of raw error text", async () => {
		mocks.getFile.mockResolvedValueOnce({
			...document,
			processingError: "Failed query: select ... params: secret",
		});
		const failed = await call({ body: { documentId }, path: "documents/get" });
		expect(failed.json).toEqual({ json: { ...document, processingError: "PROCESSING_FAILED" } });

		mocks.getFile.mockResolvedValueOnce(document);
		const clean = await call({ body: { documentId }, path: "documents/get" });
		expect(clean.json).toEqual({ json: document });
	});

	it("passes tenant scope to reads and maps missing documents to NOT_FOUND", async () => {
		mocks.getFile.mockResolvedValueOnce(document);
		const found = await call({ body: { documentId }, path: "documents/get" });

		expect(found.response?.status).toBe(200);
		expect(mocks.getFile).toHaveBeenCalledWith({ fileId: documentId, organizationId });

		mocks.getFile.mockResolvedValueOnce(null);
		const missing = await call({ body: { documentId }, path: "documents/get" });
		expect(missing.response?.status).toBe(404);

		mocks.getFile.mockResolvedValueOnce({ ...document, deletedAt: now });
		const deleted = await call({ body: { documentId }, path: "documents/get" });
		expect(deleted.response?.status).toBe(404);
	});

	it.each([
		{
			body: { documentId },
			expected: { deletedBy: "user-1", fileId: documentId, organizationId },
			invalid: { documentId: "not-a-uuid" },
			path: "documents/delete",
			service: mocks.deleteFile,
		},
		{
			body: { mediaId: documentId },
			expected: { fileId: documentId, organizationId, userId: "user-1" },
			invalid: { mediaId: "not-a-uuid" },
			path: "media/delete",
			service: mocks.deleteUploadedMedia,
		},
	])(
		"scopes $path to the organization and maps missing files to NOT_FOUND",
		async ({ body, expected, invalid, path, service }) => {
			service.mockResolvedValueOnce(true);
			const deleted = await call({ body, path });
			expect(deleted.response?.status).toBe(200);
			expect(deleted.json).toEqual({ json: { id: documentId } });
			expect(service).toHaveBeenCalledWith(expected);

			service.mockResolvedValueOnce(false);
			expect((await call({ body, path })).response?.status).toBe(404);
			expect((await call({ body: invalid, path })).response?.status).toBe(400);

			mocks.resolveSession.mockResolvedValueOnce(null);
			expect((await call({ body, path })).response?.status).toBe(401);
			expect(service).toHaveBeenCalledTimes(2);
		}
	);

	it("rejects unauthenticated and organization-less requests before services run", async () => {
		mocks.resolveSession.mockResolvedValueOnce(null);
		const unauthenticated = await call({ body: { name: "brief", text: "knowledge" }, path: "documents/create" });
		expect(unauthenticated.response?.status).toBe(401);

		mocks.resolveSession.mockResolvedValueOnce({
			session: { activeOrganizationId: null },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});

		const noOrganization = await call({ body: { name: "brief", text: "knowledge" }, path: "documents/create" });
		expect(noOrganization.response?.status).toBe(400);
		expect(mocks.createFile).not.toHaveBeenCalled();
	});

	it("rejects oversized text documents before persistence", async () => {
		const result = await call({
			body: { name: "oversized.txt", text: "x".repeat(500_001) },
			path: "documents/create",
		});

		expect(result.response?.status).toBe(400);
		expect(mocks.createFile).not.toHaveBeenCalled();
	});
});
