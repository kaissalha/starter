import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db, files, users } from "@starter/db";

const mocks = vi.hoisted(() => ({ createRun: vi.fn(), deleteBlob: vi.fn() }));

vi.mock("../../src/lib/blob-storage", () => ({
	deleteBlob: mocks.deleteBlob,
	getPublicBlobUrl: async (key: string) => `https://cdn.example.com/${key}`,
}));

vi.mock("../../src/ai", () => ({ mastra: { getWorkflow: () => ({ createRun: mocks.createRun }) } }));

import { deleteUploadedMedia, listUploadedMedia, registerUpload } from "../../src/services/media";
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
		const [photo, , ...excluded] = rows;

		if (!photo) {
			throw new Error("Missing fixtures");
		}

		for (const { id, organizationId } of [
			...excluded.map((row) => ({ ...row, organizationId: owner.id })),
			{ ...photo, organizationId: other.id },
		]) {
			await expect(deleteUploadedMedia({ fileId: id, organizationId, userId: owner.id })).resolves.toBe(false);
		}

		expect(mocks.deleteBlob).not.toHaveBeenCalled();
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
	it("registers private knowledge from the landed object and queues ingestion once", async () => {
		const owner = await createTestOrganization();
		organizations.push(owner.id);
		await db.insert(users).values({ email: `${owner.id}@example.com`, id: owner.id, name: "Uploader" });
		mocks.createRun.mockResolvedValue({ runId: "run-1", start: vi.fn() });

		const upload = {
			contentType: "application/pdf; charset=binary",
			key: `test/${owner.id}/knowledge/a1.pdf`,
			name: "report.pdf",
			organizationId: owner.id,
			purpose: "knowledge" as const,
			sizeBytes: 1024,
			userId: owner.id,
		};

		const registered = await registerUpload(upload);

		expect(registered.url).toBe(
			`/api/media?${new URLSearchParams({ fileId: registered.id, organizationId: owner.id })}`
		);
		expect(await db.query.files.findFirst({ where: { id: registered.id } })).toMatchObject({
			access: "private",
			contentType: "application/pdf",
			ingestRunId: "run-1",
			kind: "document",
			name: "report.pdf",
			ragStatus: "pending",
			sizeBytes: 1024,
			storageKey: `test/${owner.id}/knowledge/a1.pdf`,
		});
		await expect(registerUpload(upload)).resolves.toEqual(registered);
		expect(mocks.createRun).toHaveBeenCalledOnce();
	});

	it("rejects uploads that break their purpose policy without recording them", async () => {
		const owner = await createTestOrganization();
		organizations.push(owner.id);
		await db.insert(users).values({ email: `${owner.id}@example.com`, id: owner.id, name: "Uploader" });

		const register = ({ contentType, name, sizeBytes }: { contentType: string; name: string; sizeBytes: number }) =>
			registerUpload({
				contentType,
				key: `test/${owner.id}/image/${name}`,
				name,
				organizationId: owner.id,
				purpose: "image",
				sizeBytes,
				userId: owner.id,
			});

		await expect(register({ contentType: "image/svg+xml", name: "a.svg", sizeBytes: 10 })).rejects.toThrow(
			"Unsupported upload type."
		);
		await expect(
			register({ contentType: "image/png", name: "big.png", sizeBytes: 10 * 1024 * 1024 + 1 })
		).rejects.toThrow("Uploaded file exceeds its size limit.");
		expect(await db.query.files.findMany({ where: { organizationId: owner.id } })).toEqual([]);
		expect(mocks.deleteBlob).not.toHaveBeenCalled();

		await expect(register({ contentType: "image/png", name: "ok.png", sizeBytes: 10 })).resolves.toMatchObject({
			url: `https://cdn.example.com/test/${owner.id}/image/ok.png`,
		});
		expect(mocks.createRun).not.toHaveBeenCalled();
	});
});
