import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db, files, users } from "@starter/db";

const mocks = vi.hoisted(() => ({ deleteBlob: vi.fn(), headBlob: vi.fn(), startIngestFile: vi.fn() }));

vi.mock("../../src/lib/blob-storage", () => ({
	deleteBlob: mocks.deleteBlob,
	getPublicBlobUrl: async (key: string) => `https://cdn.example.com/${key}`,
	getStorageKeyPrefix: ({ organizationId, purpose }: { organizationId: string; purpose: string }) =>
		`test/${organizationId}/${purpose}/`,
	headBlob: mocks.headBlob,
}));

vi.mock("../../src/workflows/ingest-file", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/workflows/ingest-file")>()),
	startIngestFile: mocks.startIngestFile,
}));

import {
	deleteUploadedMedia,
	getUploadedMedia,
	listUploadedMedia,
	registerUpload,
	registerUploadInputSchema,
} from "../../src/services/media";
import { cleanupOrganization, createTestOrganization } from "../helpers/db";

const organizations: Array<string> = [];

afterEach(async () => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	await Promise.all(organizations.map(cleanupOrganization));

	for (const id of organizations) {
		await db.delete(users).where(eq(users.id, id));
	}

	organizations.length = 0;
});

describe("uploaded media", () => {
	it("filters private, deleted, unsupported and foreign files and binds only owned public media", async () => {
		const owner = await createTestOrganization();
		const other = await createTestOrganization();
		organizations.push(owner.id, other.id);

		const rows = await db
			.insert(files)
			.values([
				{
					contentType: "image/png",
					kind: "image",
					name: "my_photo.png",
					organizationId: owner.id,
					storageKey: "photo.png",
				},
				{
					contentType: "video/webm",
					kind: "video",
					name: "movie.webm",
					organizationId: owner.id,
					storageKey: "movie.webm",
				},
				{
					access: "private",
					contentType: "image/png",
					kind: "image",
					name: "private.png",
					organizationId: owner.id,
					storageKey: "private.png",
				},
				{
					contentType: "image/png",
					deletedAt: new Date().toISOString(),
					kind: "image",
					name: "deleted.png",
					organizationId: owner.id,
					storageKey: "deleted.png",
				},
				{
					contentType: "image/svg+xml",
					kind: "image",
					name: "script.svg",
					organizationId: owner.id,
					storageKey: "script.svg",
				},
				{
					contentType: "image/png",
					kind: "image",
					name: "foreign.png",
					organizationId: other.id,
					storageKey: "foreign.png",
				},
			])
			.returning();

		const result = await listUploadedMedia({ offset: 0, organizationId: owner.id, query: "" });
		expect(result.items.map((item) => item.name).sort()).toEqual(["movie.webm", "my_photo.png"]);
		expect(
			(await listUploadedMedia({ kind: "image", offset: 0, organizationId: owner.id, query: "_photo" })).items
		).toHaveLength(1);
		const [photo, movie, ...excluded] = rows;

		if (!photo || !movie) {
			throw new Error("Missing fixtures");
		}

		for (const row of excluded) {
			await expect(getUploadedMedia({ fileId: row.id, organizationId: owner.id })).rejects.toThrow(
				"Uploaded media not found"
			);
		}

		await expect(getUploadedMedia({ fileId: movie.id, organizationId: owner.id })).resolves.toMatchObject({
			kind: "video",
			url: `https://cdn.example.com/${movie.storageKey}`,
		});
		await expect(getUploadedMedia({ fileId: photo.id, organizationId: other.id })).rejects.toThrow(
			"Uploaded media not found"
		);
	});
});

describe("media deletion", () => {
	it("removes the Blob before soft-deleting owned public uploads and never reaches other files", async () => {
		const owner = await createTestOrganization();
		const other = await createTestOrganization();
		organizations.push(owner.id, other.id);
		await db.insert(users).values({ email: `${owner.id}@example.com`, id: owner.id, name: "Media owner" });
		const key = "photo.png";

		const [photo, ...protectedRows] = await db
			.insert(files)
			.values([
				{
					contentType: "image/png",
					kind: "image",
					name: "photo.png",
					organizationId: owner.id,
					storageKey: key,
				},
				{
					access: "private",
					contentType: "image/png",
					kind: "image",
					name: "private.png",
					organizationId: owner.id,
					storageKey: "private.png",
				},
				{
					contentType: "application/pdf",
					kind: "document",
					name: "brief.pdf",
					organizationId: owner.id,
					storageKey: "brief.pdf",
				},
				{
					contentType: "image/png",
					kind: "image",
					name: "foreign.png",
					organizationId: other.id,
					storageKey: "foreign.png",
				},
			])
			.returning();

		if (!photo) {
			throw new Error("Missing fixtures");
		}

		for (const row of protectedRows) {
			await expect(
				deleteUploadedMedia({ fileId: row.id, organizationId: owner.id, userId: owner.id })
			).resolves.toBe(false);
		}

		expect(mocks.deleteBlob).not.toHaveBeenCalled();
		expect(
			(await db.query.files.findMany({ where: { organizationId: owner.id } })).map(({ deletedAt }) => deletedAt)
		).toEqual([null, null, null]);

		mocks.deleteBlob.mockRejectedValueOnce(new Error("Blob unavailable"));
		await expect(
			deleteUploadedMedia({ fileId: photo.id, organizationId: owner.id, userId: owner.id })
		).rejects.toThrow("Blob unavailable");
		expect((await db.query.files.findFirst({ where: { id: photo.id } }))?.deletedAt).toBeNull();

		await expect(
			deleteUploadedMedia({ fileId: photo.id, organizationId: owner.id, userId: owner.id })
		).resolves.toBe(true);
		expect(mocks.deleteBlob).toHaveBeenLastCalledWith({ access: "public", key });
		expect(await db.query.files.findFirst({ where: { id: photo.id } })).toMatchObject({
			deletedAt: expect.any(String),
			deletedBy: owner.id,
		});
		expect((await listUploadedMedia({ offset: 0, organizationId: owner.id, query: "" })).items).toEqual([]);

		await expect(
			deleteUploadedMedia({ fileId: photo.id, organizationId: owner.id, userId: owner.id })
		).resolves.toBe(false);
		expect(mocks.deleteBlob).toHaveBeenCalledTimes(2);
	});
});

describe("upload registration", () => {
	it("registers private knowledge under the organization prefix and queues ingestion once", async () => {
		const owner = await createTestOrganization();
		organizations.push(owner.id);
		await db.insert(users).values({ email: `${owner.id}@example.com`, id: owner.id, name: "Uploader" });
		mocks.headBlob.mockResolvedValue({ contentType: "application/pdf; charset=binary", size: 1024 });
		mocks.startIngestFile.mockResolvedValue({ runId: "run-1" });
		const input = { key: "a1.pdf", name: "report.pdf", purpose: "knowledge" as const };

		const registered = await registerUpload({ input, organizationId: owner.id, userId: owner.id });

		expect(mocks.headBlob).toHaveBeenCalledWith({ access: "private", key: `test/${owner.id}/knowledge/a1.pdf` });
		expect(registered.url).toBe(
			`/api/media?${new URLSearchParams({ fileId: registered.id, organizationId: owner.id })}`
		);
		expect(await db.query.files.findFirst({ where: { id: registered.id } })).toMatchObject({
			access: "private",
			contentType: "application/pdf",
			ingestRunId: "run-1",
			kind: "document",
			ragStatus: "pending",
			sizeBytes: 1024,
			storageKey: `test/${owner.id}/knowledge/a1.pdf`,
		});
		await expect(registerUpload({ input, organizationId: owner.id, userId: owner.id })).resolves.toEqual(
			registered
		);
		expect(mocks.startIngestFile).toHaveBeenCalledOnce();
	});

	it("deletes and rejects uploads that break their purpose policy", async () => {
		const owner = await createTestOrganization();
		organizations.push(owner.id);
		await db.insert(users).values({ email: `${owner.id}@example.com`, id: owner.id, name: "Uploader" });

		const register = (key: string) =>
			registerUpload({ input: { key, name: key, purpose: "image" }, organizationId: owner.id, userId: owner.id });

		mocks.headBlob.mockResolvedValueOnce({ contentType: "image/svg+xml", size: 10 });
		await expect(register("a.svg")).rejects.toThrow("Unsupported upload type.");
		expect(mocks.deleteBlob).toHaveBeenLastCalledWith({ access: "public", key: `test/${owner.id}/image/a.svg` });

		mocks.headBlob.mockResolvedValueOnce({ contentType: "image/png", size: 10 * 1024 * 1024 + 1 });
		mocks.deleteBlob.mockRejectedValueOnce(new Error("Blob unavailable"));
		await expect(register("big.png")).rejects.toThrow("Uploaded file exceeds its size limit.");

		mocks.headBlob.mockResolvedValueOnce(null);
		await expect(register("gone.png")).rejects.toThrow("The upload was not found.");
		expect(await db.query.files.findMany({ where: { organizationId: owner.id } })).toEqual([]);

		mocks.headBlob.mockResolvedValueOnce({ contentType: "image/png", size: 10 });
		await expect(register("ok.png")).resolves.toMatchObject({
			url: `https://cdn.example.com/test/${owner.id}/image/ok.png`,
		});
		expect(mocks.startIngestFile).not.toHaveBeenCalled();
	});

	it.each(["../other/a.png", "nested/a.png", "", "a..png/"])("refuses non-relative key %j", (key) => {
		expect(registerUploadInputSchema.safeParse({ key, name: "a.png", purpose: "image" }).success).toBe(false);
	});
});
