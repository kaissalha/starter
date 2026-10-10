import { beforeEach, describe, expect, it, vi } from "vitest";

type MediaRow = {
	contentType: string;
	id: string;
	kind: string;
	metadata: { altText?: string };
	name: string;
	sizeBytes: number;
	storageKey: string;
	summary: string | null;
	title: string | null;
};

const mocks = vi.hoisted(() => ({
	queries: Array<{ limit: number; offset: number; rows: Array<MediaRow> }>(),
	rankRelevantCandidates: vi.fn(),
	results: Array<Array<MediaRow>>(),
}));

vi.mock("@starter/db", () => {
	const builder = { limit: 0, offset: 0 };

	const chain = {
		from: () => chain,
		limit: (value: number) => {
			builder.limit = value;

			return chain;
		},
		offset: (value: number) => {
			builder.offset = value;
			const rows = mocks.results.shift() ?? [];
			mocks.queries.push({ limit: builder.limit, offset: value, rows });

			return Promise.resolve(rows);
		},
		orderBy: () => chain,
		where: () => chain,
	};

	return { db: { select: () => chain }, files: {} };
});

vi.mock("../../src/ai/relevance", () => ({ rankRelevantCandidates: mocks.rankRelevantCandidates }));

vi.mock("../../src/services/permissions", () => ({}));

vi.mock("../../src/services/storage", () => ({}));

vi.mock("../../src/workflows/ingest-file", () => ({}));

vi.mock("../../src/lib/blob-storage", () => ({
	getPublicBlobUrl: async (key: string) => `https://example.com/${key}`,
}));

import { listUploadedMedia } from "../../src/services/media";

const row = (id: string, name: string, title?: string): MediaRow => ({
	contentType: "image/png",
	id,
	kind: "image",
	metadata: { altText: `${name} alt` },
	name,
	sizeBytes: 10,
	storageKey: name,
	summary: null,
	title: title ?? null,
});

beforeEach(() => {
	vi.clearAllMocks();
	mocks.queries.length = 0;
	mocks.results.length = 0;
});

describe("semantic uploaded media search", () => {
	it("reranks recent uploads by metadata only when the filename query is empty and semantic is requested", async () => {
		mocks.results.push([], [row("a", "img_1.png", "Latte art"), row("b", "img_2.png", "Storefront")]);
		mocks.rankRelevantCandidates.mockImplementation(async ({ candidates, text }) => {
			expect(text(candidates[0])).toBe("Latte art\nimg_1.png\nimg_1.png alt");

			return [...candidates].reverse();
		});
		const result = await listUploadedMedia({ offset: 0, organizationId: "org", query: "coffee", semantic: true });
		expect(result.items.map(({ id }) => id)).toEqual(["b", "a"]);
		expect(result.items[0]).not.toHaveProperty("metadata");
		expect(result.nextOffset).toBeNull();
		expect(mocks.queries.map(({ limit }) => limit)).toEqual([31, 20]);
		expect(mocks.rankRelevantCandidates).toHaveBeenCalledWith(
			expect.objectContaining({
				classifier: expect.objectContaining({ id: "media-semantic-search" }),
				query: "coffee",
			})
		);
	});
	it("stays model-free for filename matches and plain queries", async () => {
		mocks.results.push([row("a", "coffee.png")]);
		await expect(
			listUploadedMedia({ offset: 0, organizationId: "org", query: "coffee", semantic: true })
		).resolves.toMatchObject({ items: [{ id: "a" }] });
		mocks.results.push([]);
		await expect(listUploadedMedia({ offset: 0, organizationId: "org", query: "coffee" })).resolves.toEqual({
			items: [],
			nextOffset: null,
		});
		expect(mocks.rankRelevantCandidates).not.toHaveBeenCalled();
	});
});
