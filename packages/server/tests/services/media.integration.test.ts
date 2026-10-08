import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db, files, users, members } from "@starter/db";

const mocks = vi.hoisted(() => ({ deleteBlob: vi.fn() }));

vi.mock("../../src/lib/blob-storage", () => ({ deleteBlob: mocks.deleteBlob }));

import { deleteUploadedMedia, getUploadedMedia, listUploadedMedia, selectStockImage } from "../../src/services/media";
import { resolveWebsiteUploadedMedia } from "../../src/services/websites/assets";
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

		const bindings = await resolveWebsiteUploadedMedia({
			inputs: [
				{ fileId: movie.id, operation: "update-media", pointer: "/assetId", sectionId: crypto.randomUUID() },
			],
			organizationId: owner.id,
		});

		expect(bindings[movie.id]).toEqual({ src: movie.url, type: "video" });
		await expect(
			resolveWebsiteUploadedMedia({
				inputs: [
					{
						fileId: photo.id,
						operation: "update-media",
						pointer: "/assetId",
						sectionId: crypto.randomUUID(),
					},
				],
				organizationId: other.id,
			})
		).rejects.toThrow("Uploaded media not found");
	});
});

describe("stock media selection", () => {
	it("registers a provider photo for the authorized organization, reuses it, and excludes it from uploads", async () => {
		const owner = await createTestOrganization();
		const other = await createTestOrganization();
		organizations.push(owner.id, other.id);
		await db.insert(users).values({ email: `${owner.id}@example.com`, id: owner.id, name: "Stock editor" });
		await db.insert(members).values({ id: owner.id, organizationId: owner.id, role: "owner", userId: owner.id });
		vi.stubEnv("PEXELS_API_KEY", "test");

		const fetcher = vi.fn<typeof fetch>(async () =>
			Response.json({
				alt: "Coffee cup",
				height: 800,
				id: 84,
				photographer: "Photographer",
				photographer_url: "https://www.pexels.com/@photographer/",
				src: { original: "https://images.pexels.com/photos/84/photo.jpeg" },
				url: "https://www.pexels.com/photo/84/",
				width: 1200,
			})
		);

		vi.stubGlobal("fetch", fetcher);
		await expect(selectStockImage({ id: "pexels:84", organizationId: other.id, userId: owner.id })).rejects.toThrow(
			"permission"
		);
		expect(fetcher).not.toHaveBeenCalled();
		const media = await selectStockImage({ id: "pexels:84", organizationId: owner.id, userId: owner.id });
		expect(media).toMatchObject({ kind: "image", name: "Coffee cup" });
		expect(await getUploadedMedia({ fileId: media.id, organizationId: owner.id })).toEqual(media);
		await expect(getUploadedMedia({ fileId: media.id, organizationId: other.id })).rejects.toThrow("not found");
		expect((await selectStockImage({ id: "pexels:84", organizationId: owner.id, userId: owner.id })).id).toBe(
			media.id
		);
		expect((await listUploadedMedia({ offset: 0, organizationId: owner.id, query: "" })).items).toEqual([]);
		const stored = await db.query.files.findFirst({ where: { id: media.id } });
		expect(stored?.metadata.stockImage).toMatchObject({ id: "pexels:84", provider: "pexels" });

		const [external] = await db
			.insert(files)
			.values({
				contentType: "image/jpeg",
				kind: "image",
				name: "Unregistered URL",
				organizationId: owner.id,
				sourceType: "url",
				url: "https://example.com/photo.jpg",
			})
			.returning();

		if (!external) {
			throw new Error("Missing URL fixture");
		}

		await expect(getUploadedMedia({ fileId: external.id, organizationId: owner.id })).rejects.toThrow("not found");
		await expect(
			deleteUploadedMedia({ fileId: external.id, organizationId: owner.id, userId: owner.id })
		).resolves.toBe(false);
		await expect(
			deleteUploadedMedia({ fileId: media.id, organizationId: owner.id, userId: owner.id })
		).resolves.toBe(true);
		expect(mocks.deleteBlob).not.toHaveBeenCalled();
		expect((await db.query.files.findFirst({ where: { id: media.id } }))?.deletedBy).toBe(owner.id);
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
