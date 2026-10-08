import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db, files, users } from "@starter/db";

const mocks = vi.hoisted(() => ({ deleteBlob: vi.fn() }));

vi.mock("../../src/lib/blob-storage", () => ({ deleteBlob: mocks.deleteBlob }));

import { deleteUploadedMedia, getUploadedMedia, listUploadedMedia } from "../../src/services/media";
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
					url: "https://example.com/photo.png",
				},
				{
					contentType: "video/webm",
					kind: "video",
					name: "movie.webm",
					organizationId: owner.id,
					url: "https://example.com/movie.webm",
				},
				{
					access: "private",
					contentType: "image/png",
					kind: "image",
					name: "private.png",
					organizationId: owner.id,
					url: "https://example.com/private.png",
				},
				{
					contentType: "image/png",
					deletedAt: new Date().toISOString(),
					kind: "image",
					name: "deleted.png",
					organizationId: owner.id,
					url: "https://example.com/deleted.png",
				},
				{
					contentType: "image/svg+xml",
					kind: "image",
					name: "script.svg",
					organizationId: owner.id,
					url: "https://example.com/script.svg",
				},
				{
					contentType: "image/png",
					kind: "image",
					name: "foreign.png",
					organizationId: other.id,
					url: "https://example.com/foreign.png",
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
			url: movie.url,
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
		const url = "https://blob.example.com/production/photo.png";

		const [photo, ...protectedRows] = await db
			.insert(files)
			.values([
				{ contentType: "image/png", kind: "image", name: "photo.png", organizationId: owner.id, url },
				{
					access: "private",
					contentType: "image/png",
					kind: "image",
					name: "private.png",
					organizationId: owner.id,
					url: "https://blob.example.com/production/private.png",
				},
				{
					contentType: "application/pdf",
					kind: "document",
					name: "brief.pdf",
					organizationId: owner.id,
					url: "https://blob.example.com/production/brief.pdf",
				},
				{
					contentType: "image/png",
					kind: "image",
					name: "foreign.png",
					organizationId: other.id,
					url: "https://blob.example.com/production/foreign.png",
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
		expect(mocks.deleteBlob).toHaveBeenLastCalledWith({ access: "public", url });
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
