import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ delete: vi.fn(), get: vi.fn(), head: vi.fn() }));

vi.mock("@vercel/blob", async (importOriginal) => ({
	...(await importOriginal<typeof import("@vercel/blob")>()),
	get: mocks.get,
}));

vi.mock("files-sdk", () => ({
	Files: class {
		delete = mocks.delete;
		head = mocks.head;
	},
}));

import { MAX_INGEST_FILE_SIZE_BYTES } from "@starter/documents";

import { deleteBlob, downloadBlob, getBlob, getBlobSize } from "../../src/lib/blob-storage";

describe("blob reads", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-private-token");
		mocks.head.mockResolvedValue({ size: 4 });
	});
	afterEach(() => vi.unstubAllEnvs());

	it("cancels oversized downloads before reading any bytes", async () => {
		const cancel = vi.fn();
		mocks.get.mockResolvedValue({
			blob: { contentType: "text/plain", etag: "etag", size: MAX_INGEST_FILE_SIZE_BYTES + 1 },
			statusCode: 200,
			stream: new ReadableStream({ cancel }),
		});
		await expect(downloadBlob({ access: "private", url: "https://blob.example.com/large.txt" })).rejects.toThrow(
			"File exceeds the ingestion byte limit"
		);
		expect(cancel).toHaveBeenCalledOnce();
		expect(mocks.head).not.toHaveBeenCalled();
	});

	it("cancels the actual stream if bytes exceed a smaller advertised size", async () => {
		const cancel = vi.fn();
		mocks.get.mockResolvedValue({
			blob: { contentType: "text/plain", etag: "etag", size: 4 },
			statusCode: 200,
			stream: new ReadableStream({
				cancel,
				start(controller) {
					controller.enqueue(new Uint8Array(MAX_INGEST_FILE_SIZE_BYTES + 1));
				},
			}),
		});
		await expect(downloadBlob({ access: "private", url: "https://blob.example.com/large.txt" })).rejects.toThrow(
			"File exceeds the ingestion byte limit"
		);
		expect(cancel).toHaveBeenCalledOnce();
	});

	it("accepts downloads exactly at the byte limit", async () => {
		const bytes = Buffer.alloc(MAX_INGEST_FILE_SIZE_BYTES);
		mocks.get.mockResolvedValue({
			blob: { contentType: "text/plain", etag: "etag", size: bytes.length },
			statusCode: 200,
			stream: new Blob([bytes]).stream(),
		});
		const { body } = await downloadBlob({ access: "private", url: "https://blob.example.com/safe.txt" });
		expect(body.equals(bytes)).toBe(true);
		await expect(getBlobSize({ access: "private", url: "https://blob.example.com/safe.txt" })).resolves.toBe(4);
	});

	it("passes conditional reads to the streaming provider and preserves 304 responses", async () => {
		mocks.get.mockResolvedValue({ blob: { etag: "etag" }, statusCode: 304, stream: null });
		await expect(getBlob({ access: "private", ifNoneMatch: '"etag"', pathname: "/report.pdf" })).resolves.toEqual({
			etag: "etag",
			status: 304,
		});
		expect(mocks.get).toHaveBeenCalledWith("report.pdf", {
			access: "private",
			ifNoneMatch: '"etag"',
			token: "test-private-token",
		});
	});

	it("looks up blobs whose filenames are percent-encoded in their URL by the decoded pathname", async () => {
		await getBlobSize({ access: "private", url: "https://blob.example.com/org/Screenshot%202026%20%D8%B5.png" });
		expect(mocks.head).toHaveBeenCalledWith("org/Screenshot 2026 ص.png");
	});

	it("deletes Blob objects by pathname key", async () => {
		await deleteBlob({ access: "private", url: "https://blob.example.com/prod/a-1.txt" });
		expect(mocks.delete).toHaveBeenCalledExactlyOnceWith("prod/a-1.txt");
	});
});
