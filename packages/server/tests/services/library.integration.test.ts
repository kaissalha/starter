import { afterEach, describe, expect, it, vi } from "vitest";

import { db, fileTagAssignments, fileTags, files } from "@starter/db";

vi.mock("../../src/lib/blob-storage", () => ({
	deleteBlob: vi.fn(),
	getPublicBlobUrl: async (key: string) => `https://cdn.example.com/${key}`,
	getStorageKeyPrefix: vi.fn(),
	uploadBufferToBlob: vi.fn(),
}));

vi.mock("../../src/services/documents", () => ({ startFileIngestion: vi.fn() }));

import { getLibraryAsset, listLibraryAssets } from "../../src/services/library";
import { cleanupTestActors, createTestOrganization } from "../helpers/db";

const organizations: Array<string> = [];

afterEach(() => cleanupTestActors(organizations));

const list = (organizationId: string, query = "", versions: "all" | "latest" = "latest") =>
	listLibraryAssets({
		input: { kind: "all", offset: 0, query, sort: "newest", source: "all", versions },
		organizationId,
	});

describe("library assets", () => {
	it("groups image versions under their latest one, including a version still generating", async () => {
		const owner = await createTestOrganization();
		organizations.push(owner.id);

		const [original] = await db
			.insert(files)
			.values({
				contentType: "image/png",
				createdAt: "2026-01-01T00:00:00Z",
				kind: "image",
				name: "Storefront",
				organizationId: owner.id,
				storageKey: "storefront.png",
			})
			.returning();

		if (!original) {
			throw new Error("Missing fixture");
		}

		const [generating] = await db
			.insert(files)
			.values({
				contentType: "image/png",
				createdAt: "2026-01-02T00:00:00Z",
				kind: "image",
				metadata: { generation: { model: "test", prompt: "Add a neon sign", sourceFileId: original.id } },
				name: "Storefront",
				organizationId: owner.id,
				ragStatus: "pending",
				versionGroupId: original.id,
			})
			.returning();

		const { counts, items } = await list(owner.id);
		expect(counts.all).toBe(1);
		expect(items).toEqual([expect.objectContaining({ generating: true, id: generating?.id, versionCount: 2 })]);

		expect((await list(owner.id, "", "all")).items.map(({ id }) => id)).toEqual([generating?.id, original.id]);

		const detail = await getLibraryAsset({ assetId: original.id, organizationId: owner.id });
		expect(detail.versions.map(({ generating: pending, id }) => ({ id, pending }))).toEqual([
			{ id: original.id, pending: false },
			{ id: generating?.id, pending: true },
		]);
	});

	it("searches enrichment metadata, generation prompts, document content and tags", async () => {
		const owner = await createTestOrganization();
		organizations.push(owner.id);

		const [photo] = await db
			.insert(files)
			.values([
				{
					contentType: "image/png",
					kind: "image",
					metadata: { altText: "A barista pouring latte art", ocrText: "OPEN DAILY" },
					name: "IMG_0001.png",
					organizationId: owner.id,
					storageKey: "a.png",
				},
				{
					content: "# Price list\n\nHedge trimming costs 40 dollars.",
					contentType: "text/markdown",
					kind: "text",
					name: "Untitled document",
					organizationId: owner.id,
					sourceType: "text",
				},
			])
			.returning();

		const [tag] = await db
			.insert(fileTags)
			.values({ name: "espresso", organizationId: owner.id, slug: "espresso" })
			.returning();

		if (!photo || !tag) {
			throw new Error("Missing fixture");
		}

		await db.insert(fileTagAssignments).values({ fileId: photo.id, organizationId: owner.id, tagId: tag.id });

		const names = async (query: string) => (await list(owner.id, query)).items.map(({ name }) => name);
		expect(await names("barista")).toEqual(["IMG_0001.png"]);
		expect(await names("daily")).toEqual(["IMG_0001.png"]);
		expect(await names("hedge")).toEqual(["Untitled document"]);
		expect(await names("espress")).toEqual(["IMG_0001.png"]);
		expect(await names("nothing-matches")).toEqual([]);
	});
});
