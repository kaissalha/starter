import { eq } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { db, members, users } from "@starter/db";

const mocks = vi.hoisted(() => ({
	createFile: vi.fn(),
	deleteBlob: vi.fn(),
	findFileByUrl: vi.fn(),
	getBlob: vi.fn(),
	getBlobSize: vi.fn(),
	handleClientUpload: vi.fn(),
	markFileFailed: vi.fn(),
	resolveSession: vi.fn(),
	setFileIngestRunId: vi.fn(),
	startIngestFile: vi.fn(),
}));

vi.mock("../../src/lib/auth", () => ({ resolveSession: mocks.resolveSession }));

vi.mock("../../src/lib/blob-storage", () => ({
	deleteBlob: mocks.deleteBlob,
	getBlob: mocks.getBlob,
	getBlobSize: mocks.getBlobSize,
	handleClientUpload: mocks.handleClientUpload,
}));

vi.mock("../../src/services/storage", () => ({
	createFile: mocks.createFile,
	findFileByUrl: mocks.findFileByUrl,
	getFile: vi.fn(),
	markFileFailed: mocks.markFileFailed,
	setFileIngestRunId: mocks.setFileIngestRunId,
}));

vi.mock("../../src/workflows/ingest-file", () => ({ startIngestFile: mocks.startIngestFile }));

import { handleGetMedia, handleMediaUpload } from "../../src/api/media";
import { cleanupOrganization, createTestOrganization } from "../helpers/db";

type MutableReference<Value> = { value: Value };

const completeKnowledgeUpload = async (organizationId: string | undefined) => {
	await db.update(members).set({ role: "admin" }).where(eq(members.userId, userId));
	mocks.handleClientUpload.mockImplementationOnce(async ({ onUploadCompleted }) => {
		await onUploadCompleted({
			blob: {
				contentType: "application/pdf",
				pathname: "report.pdf",
				url: "https://blob.example.com/report.pdf",
			},
			tokenPayload: JSON.stringify({
				access: "private",
				maximumSizeInBytes: 1024 * 1024,
				organizationId,
				purpose: "knowledge",
				userId,
			}),
		});

		return { ok: true };
	});

	return handleMediaUpload(
		new Request("https://example.com/api/media", {
			body: JSON.stringify({
				payload: { clientPayload: "{}", multipart: false, pathname: "report.pdf" },
				type: "blob.generate-client-token",
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		})
	);
};

const userId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const organizationIds: Array<string> = [];

afterEach(async () => {
	vi.unstubAllEnvs();

	for (const organizationId of organizationIds) {
		await cleanupOrganization(organizationId);
	}

	organizationIds.length = 0;
	await db.delete(users).where(eq(users.id, userId));
});

describe("media HTTP integration", () => {
	const organizationIdReference: MutableReference<string | undefined> = { value: undefined };

	beforeEach(async () => {
		vi.clearAllMocks();
		mocks.getBlobSize.mockResolvedValue(1024);
		mocks.startIngestFile.mockResolvedValue({ runId: "run-1" });
		mocks.deleteBlob.mockResolvedValue(undefined);
		process.env.VERCEL_BLOB_CALLBACK_URL = "https://example.com";

		await db.insert(users).values({
			email: `media-${crypto.randomUUID()}@example.com`,
			emailVerified: true,
			id: userId,
			name: "Media User",
		});

		const organization = await createTestOrganization();
		organizationIdReference.value = organization.id;
		organizationIds.push(organizationIdReference.value);

		await db.insert(members).values({
			id: crypto.randomUUID(),
			organizationId: organizationIdReference.value,
			role: "member",
			userId,
		});

		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: organizationIdReference.value },
			user: { email: "media@example.com", id: userId, name: "Media User" },
		});
	});

	it("redirects public media only after a live organization membership check", async () => {
		const url = "https://blob.example.com/public/photo.jpg";
		mocks.findFileByUrl.mockResolvedValue({ access: "public", name: "photo.jpg", url });

		const response = await handleGetMedia(
			new Request(
				`https://example.com/api/media?organizationId=${organizationIdReference.value}&url=${encodeURIComponent(url)}`
			)
		);

		expect(response.status).toBe(302);
		expect(mocks.resolveSession).toHaveBeenCalledWith(expect.any(Headers), false);
		expect(response.headers.get("location")).toBe(url);
		expect(mocks.findFileByUrl).toHaveBeenCalledWith({ organizationId: organizationIdReference.value, url });
	});

	it("forbids cross-organization reads before looking up a blob", async () => {
		const other = await createTestOrganization();
		organizationIds.push(other.id);
		const url = "https://blob.example.com/private.pdf";

		await expect(
			handleGetMedia(
				new Request(`https://example.com/api/media?organizationId=${other.id}&url=${encodeURIComponent(url)}`)
			)
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		expect(mocks.findFileByUrl).not.toHaveBeenCalled();
	});

	it("serves private bytes and conditional 304 responses with safe headers", async () => {
		const url = "https://blob.example.com/org/report.pdf";
		mocks.findFileByUrl.mockResolvedValue({ access: "private", name: 'report"\n.pdf', url });
		mocks.getBlob.mockResolvedValueOnce({ etag: "etag-1", status: 304 });

		const conditional = await handleGetMedia(
			new Request(
				`https://example.com/api/media?organizationId=${organizationIdReference.value}&url=${encodeURIComponent(url)}`,
				{
					headers: { "if-none-match": '"etag-1"' },
				}
			)
		);

		expect(conditional.status).toBe(304);
		expect(conditional.headers.get("etag")).toBe('"etag-1"');
		expect(conditional.headers.get("content-security-policy")).toContain("sandbox");
		expect(conditional.headers.get("x-content-type-options")).toBe("nosniff");

		mocks.getBlob.mockResolvedValueOnce({
			contentType: "application/pdf",
			etag: "etag-2",
			status: 200,
			stream: new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode("pdf-bytes"));
					controller.close();
				},
			}),
		});

		const response = await handleGetMedia(
			new Request(
				`https://example.com/api/media?organizationId=${organizationIdReference.value}&url=${encodeURIComponent(url)}`
			)
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toBe('inline; filename="report.pdf"');
		expect(response.headers.get("content-security-policy")).toBe(
			"default-src 'none'; sandbox; frame-ancestors 'none'"
		);
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(await response.text()).toBe("pdf-bytes");
	});

	it.each(["text/html; charset=utf-8", "image/svg+xml", "application/xml", "application/octet-stream"])(
		"downloads private %s content with a script-blocking policy even without a filename",
		async (contentType) => {
			const url = "https://blob.example.com/org/document";
			mocks.findFileByUrl.mockResolvedValue({ access: "private", url });
			mocks.getBlob.mockResolvedValue({ contentType, status: 200, stream: new ReadableStream() });

			const response = await handleGetMedia(
				new Request(
					`https://example.com/api/media?organizationId=${organizationIdReference.value}&url=${encodeURIComponent(url)}`
				)
			);

			expect(response.headers.get("content-disposition")).toBe("attachment");
			expect(response.headers.get("content-security-policy")).toContain("sandbox");
			expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		}
	);

	it("binds upload tokens to the member and queues indexable completed uploads", async () => {
		await db.update(members).set({ role: "admin" }).where(eq(members.userId, userId));
		mocks.handleClientUpload.mockImplementationOnce(async ({ onBeforeGenerateToken }) =>
			onBeforeGenerateToken(
				"report.pdf",
				JSON.stringify({
					access: "private",
					maxFileSizeMb: 2,
					organizationId: organizationIdReference.value,
					purpose: "knowledge",
				})
			)
		);

		const tokenResponse = await handleMediaUpload(
			new Request("https://example.com/api/media", {
				body: JSON.stringify({
					payload: {
						clientPayload: JSON.stringify({ organizationId: organizationIdReference.value }),
						multipart: false,
						pathname: "report.pdf",
					},
					type: "blob.generate-client-token",
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			})
		);

		const token = z
			.object({ maximumSizeInBytes: z.number(), tokenPayload: z.string() })
			.parse(await tokenResponse.json());

		expect(token).toMatchObject({ maximumSizeInBytes: 2 * 1024 * 1024 });
		expect(JSON.parse(token.tokenPayload)).toMatchObject({
			access: "private",
			organizationId: organizationIdReference.value,
			purpose: "knowledge",
			userId,
		});

		mocks.createFile.mockResolvedValue({ created: true, file: { id: "file-1" } });

		mocks.handleClientUpload.mockImplementationOnce(async ({ onUploadCompleted }) => {
			await onUploadCompleted({
				blob: {
					contentType: "application/pdf; charset=binary",
					pathname: "report.pdf",
					url: "https://blob.example.com/report.pdf",
				},
				tokenPayload: JSON.stringify({
					access: "private",
					maximumSizeInBytes: 2 * 1024 * 1024,
					organizationId: organizationIdReference.value,
					purpose: "knowledge",
					userId,
				}),
			});

			return { ok: true };
		});

		await handleMediaUpload(
			new Request("https://example.com/api/media", {
				body: JSON.stringify({
					payload: {
						blob: {
							contentDisposition: "attachment",
							contentType: "application/pdf",
							downloadUrl: "https://blob.example.com/report.pdf?download=1",
							etag: "etag",
							pathname: "report.pdf",
							url: "https://blob.example.com/report.pdf",
						},
						tokenPayload: "token",
					},
					type: "blob.upload-completed",
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			})
		);

		expect(mocks.createFile).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "document",
				organizationId: organizationIdReference.value,
				ragStatus: "pending",
				sizeBytes: 1024,
				uploadedBy: userId,
			})
		);

		expect(mocks.startIngestFile).toHaveBeenCalledWith({
			fileId: "file-1",
			organizationId: organizationIdReference.value,
		});
	});

	it("deletion failure of a rejected blob does not mask the 400", async () => {
		mocks.deleteBlob.mockRejectedValue(new Error("blob store unavailable"));
		mocks.getBlobSize.mockResolvedValueOnce(2 * 1024 * 1024);

		await expect(completeKnowledgeUpload(organizationIdReference.value)).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "Uploaded file exceeds its size limit.",
		});
		expect(mocks.deleteBlob).toHaveBeenCalledWith({
			access: "private",
			url: "https://blob.example.com/report.pdf",
		});
		expect(mocks.createFile).not.toHaveBeenCalled();
	});

	it.each(["not json", JSON.stringify({ payload: {} })])("maps malformed upload body %j to 400", async (body) => {
		await expect(
			handleMediaUpload(new Request("https://example.com/api/media", { body, method: "POST" }))
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(mocks.handleClientUpload).not.toHaveBeenCalled();
	});

	it("does not start a second ingest when the completion callback is redelivered", async () => {
		mocks.createFile.mockResolvedValue({ created: false, file: { id: "file-1" } });

		await completeKnowledgeUpload(organizationIdReference.value);
		expect(mocks.createFile).toHaveBeenCalledOnce();
		expect(mocks.startIngestFile).not.toHaveBeenCalled();
	});

	it("marks a knowledge upload failed when the ingest workflow cannot start", async () => {
		mocks.createFile.mockResolvedValue({ created: true, file: { id: "file-1" } });
		mocks.startIngestFile.mockRejectedValueOnce(new Error("workflow unavailable"));

		await expect(completeKnowledgeUpload(organizationIdReference.value)).rejects.toThrow("workflow unavailable");
		expect(mocks.markFileFailed).toHaveBeenCalledWith(
			expect.objectContaining({ fileId: "file-1", organizationId: organizationIdReference.value })
		);
		expect(mocks.setFileIngestRunId).not.toHaveBeenCalled();
	});

	it.each([
		{ access: "public", contentType: "image/png", kind: "image", limit: 10, purpose: "image" },
		{ access: "public", contentType: "video/mp4", kind: "video", limit: 100, purpose: "video" },
		{ access: "private", contentType: "application/pdf", kind: "document", limit: 5, purpose: "knowledge" },
	])(
		"enforces server-owned access, types and size for $purpose uploads",
		async ({ access, contentType, kind, limit, purpose }) => {
			await db.update(members).set({ role: "admin" }).where(eq(members.userId, userId));
			const organizationId = organizationIdReference.value;
			mocks.createFile.mockResolvedValue({ created: true, file: { id: "uploaded-media" } });
			mocks.handleClientUpload.mockImplementationOnce(async ({ onBeforeGenerateToken, onUploadCompleted }) => {
				const token = await onBeforeGenerateToken(
					"media",
					JSON.stringify({ access, maxFileSizeMb: 5000, organizationId, purpose })
				);

				expect(token.maximumSizeInBytes).toBe(limit * 1024 * 1024);
				expect(token.allowedContentTypes).toContain(contentType);
				expect(token.allowedContentTypes).not.toContain("image/svg+xml");
				await expect(
					onBeforeGenerateToken(
						"media",
						JSON.stringify({ access: access === "public" ? "private" : "public", organizationId, purpose })
					)
				).rejects.toMatchObject({ code: "BAD_REQUEST" });
				await expect(
					onUploadCompleted({
						blob: {
							contentType: "application/javascript",
							pathname: "media",
							url: "https://blob.example.com/media",
						},
						tokenPayload: token.tokenPayload,
					})
				).rejects.toMatchObject({ code: "BAD_REQUEST" });
				expect(mocks.createFile).not.toHaveBeenCalled();
				expect(mocks.deleteBlob).toHaveBeenLastCalledWith({ access, url: "https://blob.example.com/media" });
				mocks.deleteBlob.mockClear();
				mocks.getBlobSize.mockResolvedValueOnce(limit * 1024 * 1024 + 1);
				await expect(
					onUploadCompleted({
						blob: { contentType, pathname: "media", url: "https://blob.example.com/media" },
						tokenPayload: token.tokenPayload,
					})
				).rejects.toMatchObject({ code: "BAD_REQUEST" });
				expect(mocks.createFile).not.toHaveBeenCalled();
				expect(mocks.deleteBlob).toHaveBeenCalledExactlyOnceWith({
					access,
					url: "https://blob.example.com/media",
				});
				await onUploadCompleted({
					blob: { contentType, pathname: "media", url: "https://blob.example.com/media" },
					tokenPayload: token.tokenPayload,
				});

				return { ok: true };
			});
			await handleMediaUpload(
				new Request("https://example.com/api/media", {
					body: JSON.stringify({
						payload: { clientPayload: "{}", multipart: false, pathname: "media" },
						type: "blob.generate-client-token",
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
				})
			);
			expect(mocks.createFile).toHaveBeenCalledWith(
				expect.objectContaining({
					access,
					contentType,
					kind,
					organizationId,
					ragStatus: purpose === "knowledge" ? "pending" : "none",
					sizeBytes: 1024,
				})
			);
			expect(mocks.startIngestFile).toHaveBeenCalledTimes(purpose === "knowledge" ? 1 : 0);
		}
	);

	it.each(["public", "private"] as const)(
		"verifies the original signed %s callback with the real Blob SDK",
		async (access) => {
			await db.update(members).set({ role: "admin" }).where(eq(members.userId, userId));
			vi.stubEnv("BLOB_PUBLIC_READ_WRITE_TOKEN", "test-public-signing-key");
			vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-private-signing-key");

			const { handleClientUpload } =
				await vi.importActual<typeof import("../../src/lib/blob-storage")>("../../src/lib/blob-storage");

			mocks.handleClientUpload.mockImplementation(handleClientUpload);
			mocks.createFile.mockResolvedValue({ created: true, file: { id: "signed-image" } });

			const payload = {
				blob: {
					contentDisposition: "inline",
					contentType: "image/png",
					downloadUrl: "https://blob.example.com/signed.png?download=1",
					etag: "etag",
					pathname: "signed.png",
					size: 123,
					url: "https://blob.example.com/signed.png",
				},
				tokenPayload: JSON.stringify({
					access,
					maximumSizeInBytes: 10 * 1024 * 1024,
					organizationId: organizationIdReference.value,
					purpose: access === "public" ? "image" : "knowledge",
					userId,
				}),
			};

			const body = `{"type":"blob.upload-completed","payload":${JSON.stringify(payload)}}`;
			const signature = createHmac("sha256", `test-${access}-signing-key`).update(body).digest("hex");

			const request = (payload: string) =>
				new Request("https://example.com/api/media", {
					body: payload,
					headers: { "content-type": "application/json", "x-vercel-signature": signature },
					method: "POST",
				});

			expect((await handleMediaUpload(request(body))).status).toBe(200);
			expect(mocks.createFile).toHaveBeenCalledOnce();
			expect(mocks.createFile).toHaveBeenCalledWith(
				expect.objectContaining({ access, url: "https://blob.example.com/signed.png" })
			);
			await expect(handleMediaUpload(request(body.replaceAll("signed.png", "tampered.png")))).rejects.toThrow(
				"Invalid callback signature"
			);
			expect(mocks.createFile).toHaveBeenCalledOnce();
		}
	);

	it("rejects Member upload tokens and completion callbacks", async () => {
		const organizationId = organizationIdReference.value;

		const request = () =>
			new Request("https://example.com/api/media", {
				body: JSON.stringify({
					payload: {
						clientPayload: JSON.stringify({ organizationId }),
						multipart: false,
						pathname: "report.pdf",
					},
					type: "blob.generate-client-token",
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			});

		mocks.handleClientUpload.mockImplementationOnce(async ({ onBeforeGenerateToken }) =>
			onBeforeGenerateToken("report.pdf", JSON.stringify({ organizationId }))
		);
		await expect(handleMediaUpload(request())).rejects.toMatchObject({ code: "FORBIDDEN" });
		mocks.handleClientUpload.mockImplementationOnce(async ({ onUploadCompleted }) =>
			onUploadCompleted({
				blob: {
					contentType: "application/pdf",
					pathname: "report.pdf",
					url: "https://blob.example.com/report.pdf",
				},
				tokenPayload: JSON.stringify({ access: "private", maximumSizeInBytes: 1024, organizationId, userId }),
			})
		);
		await expect(handleMediaUpload(request())).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.createFile).not.toHaveBeenCalled();
		expect(mocks.startIngestFile).not.toHaveBeenCalled();
	});
});
