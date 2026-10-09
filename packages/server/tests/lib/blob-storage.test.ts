import { FilesError } from "files-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ delete: vi.fn(), head: vi.fn() }));

vi.mock("files-sdk", async (importOriginal) => ({
	...(await importOriginal<typeof import("files-sdk")>()),
	Files: class {
		delete = mocks.delete;
		head = mocks.head;
	},
}));

import { MAX_INGEST_FILE_SIZE_BYTES } from "@starter/documents";

import { deleteBlob, downloadBlob, getBlob, headBlob } from "../../src/lib/blob-storage";

describe("blob reads", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-private-token");
		mocks.head.mockResolvedValue({ size: 4 });
	});
	afterEach(() => vi.unstubAllEnvs());

	it("cancels oversized downloads before reading any bytes", async () => {
		const cancel = vi.fn();
		mocks.head.mockResolvedValue({
			etag: "etag",
			size: MAX_INGEST_FILE_SIZE_BYTES + 1,
			stream: () => new ReadableStream({ cancel }),
			type: "text/plain",
		});
		await expect(downloadBlob({ access: "private", key: "large.txt" })).rejects.toThrow(
			"File exceeds the ingestion byte limit"
		);
		expect(cancel).toHaveBeenCalledOnce();
	});

	it("cancels the actual stream if bytes exceed a smaller advertised size", async () => {
		const cancel = vi.fn();
		mocks.head.mockResolvedValue({
			etag: "etag",
			size: 4,
			stream: () =>
				new ReadableStream({
					cancel,
					start(controller) {
						controller.enqueue(new Uint8Array(MAX_INGEST_FILE_SIZE_BYTES + 1));
					},
				}),
			type: "text/plain",
		});
		await expect(downloadBlob({ access: "private", key: "large.txt" })).rejects.toThrow(
			"File exceeds the ingestion byte limit"
		);
		expect(cancel).toHaveBeenCalledOnce();
	});

	it("accepts downloads exactly at the byte limit", async () => {
		const bytes = Buffer.alloc(MAX_INGEST_FILE_SIZE_BYTES);
		mocks.head.mockResolvedValue({
			etag: "etag",
			size: bytes.length,
			stream: () => new Blob([bytes]).stream(),
			type: "text/plain",
		});
		const { body } = await downloadBlob({ access: "private", key: "safe.txt" });
		expect(body.equals(bytes)).toBe(true);
		await expect(headBlob({ access: "private", key: "safe.txt" })).resolves.toEqual({
			contentType: "text/plain",
			size: bytes.length,
		});
	});

	it("answers matching conditional reads with 304 without opening the body stream", async () => {
		const stream = vi.fn();
		mocks.head.mockResolvedValue({ etag: "etag", size: 4, stream, type: "application/pdf" });
		await expect(getBlob({ access: "private", ifNoneMatch: '"etag"', key: "report.pdf" })).resolves.toEqual({
			etag: "etag",
			status: 304,
		});
		expect(mocks.head).toHaveBeenCalledWith("report.pdf");
		expect(stream).not.toHaveBeenCalled();
	});

	it("returns null for missing blobs", async () => {
		mocks.head.mockRejectedValue(new FilesError("NotFound", "missing"));
		await expect(getBlob({ access: "private", key: "missing.pdf" })).resolves.toBeNull();
	});

	it("deletes Blob objects by storage key", async () => {
		await deleteBlob({ access: "private", key: "prod/a-1.txt" });
		expect(mocks.delete).toHaveBeenCalledExactlyOnceWith("prod/a-1.txt");
	});
});
