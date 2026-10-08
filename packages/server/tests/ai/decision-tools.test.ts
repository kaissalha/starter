import { noopObserve } from "@mastra/core/tools";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sectionAuthoringReference } from "@starter/infinite-website/editing";
import { templatePreviews } from "@starter/infinite-website/template-previews";

const mocks = vi.hoisted(() => ({
	evaluateDecision: vi.fn(),
	getWebsite: vi.fn(),
	requireOrganizationPermission: vi.fn(),
	search: vi.fn(),
	searchStockImages: vi.fn(),
	selectStockImage: vi.fn(),
}));

vi.mock("../../src/ai/decisions", () => ({ evaluateDecision: mocks.evaluateDecision }));

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: mocks.requireOrganizationPermission,
}));

vi.mock("../../src/lib/firecrawl", () => ({ firecrawl: { search: mocks.search } }));

vi.mock("../../src/services/websites/service", () => ({ getWebsite: mocks.getWebsite }));

vi.mock("../../src/services/media", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/media")>()),
	searchStockImages: mocks.searchStockImages,
	selectStockImage: mocks.selectStockImage,
}));

import { rankRelevantCandidates, relevanceRank } from "../../src/ai/relevance";
import { dashboardSkills, loadDashboardRoute } from "../../src/ai/skills";
import { assistantTools } from "../../src/ai/tools/assistant";
import { inspectWebsiteTools } from "../../src/ai/tools/inspect-website";
import { createDashboardChatRequestContext } from "../../src/ai/types";

const context = () => ({
	observe: noopObserve,
	requestContext: createDashboardChatRequestContext({ organizationId: "org", userId: "user" }),
});

const findImage = assistantTools.findStockImage.execute;

const webSearch = assistantTools.webSearch.execute;

const inspect = inspectWebsiteTools.inspectWebsite.execute;

if (!findImage || !webSearch || !inspect) {
	throw new Error("Decision tool handlers are missing");
}

const image = (id: string, alt: string) => ({
	alt,
	height: 100,
	hotlinkUrl: "https://images.pexels.com/photo.jpeg",
	id,
	provider: "pexels",
	sources: [],
	thumbnailUrl: "https://images.pexels.com/thumb.jpeg",
	width: 100,
});

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireOrganizationPermission.mockResolvedValue("owner");
	mocks.evaluateDecision.mockResolvedValue(null);
});

describe("bounded decision tools", () => {
	it("loads exactly the selected canonical domain and operation and falls back without activation", () => {
		expect(loadDashboardRoute("website-modify")).toMatchObject({
			instructions: expect.stringContaining("Selected mode: modify"),
			reference: "modify",
			skill: "website",
		});
		expect(loadDashboardRoute("none")).toMatchObject({ reference: null, skill: null });
		expect(loadDashboardRoute(undefined)).toMatchObject({ reference: null, skill: null });
	});
	it.each(["edit", "catalog", "compose", "modify"])(
		"loads common website instructions once while retaining the %s operation",
		(operation) => {
			const website = dashboardSkills.find(({ name }) => name === "website");

			if (!website) {
				throw new Error("Website skill is missing");
			}

			const result = loadDashboardRoute(`website-${operation}`);
			expect(result.instructions).toContain(website.instructions);
			expect(result.instructions.split("Inspect current state in the same turn")).toHaveLength(2);
			expect(result.instructions).toContain(`Selected mode: ${operation}`);
			expect(result.instructions).toContain("The operation reference above is already loaded for this turn");
			expect(result.instructions.includes(sectionAuthoringReference)).toBe(
				operation === "compose" || operation === "modify"
			);
		}
	);
	it("checks access before stock providers", async () => {
		mocks.requireOrganizationPermission.mockRejectedValue(new Error("Forbidden"));
		await expect(findImage({ page: 1, purpose: "Coffee hero", query: "coffee" }, context())).rejects.toThrow(
			"Forbidden"
		);
		expect(mocks.evaluateDecision).not.toHaveBeenCalled();
		expect(mocks.searchStockImages).not.toHaveBeenCalled();
	});
	it("prepares only an exact search result through the existing binding service", async () => {
		mocks.searchStockImages.mockResolvedValue({
			items: [image("pexels:1", "Tea"), image("pexels:2", "Coffee")],
			nextPage: null,
			partial: false,
		});
		mocks.evaluateDecision.mockResolvedValue({ answers: { image: { choice: "pexels:2" } } });

		const prepared = {
			contentType: "image/jpeg",
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330",
			kind: "image",
			name: "Coffee",
			sizeBytes: null,
			url: "https://images.pexels.com/photo.jpeg",
		};

		mocks.selectStockImage.mockResolvedValue(prepared);
		await expect(findImage({ page: 1, purpose: "Coffee hero", query: "coffee" }, context())).resolves.toMatchObject(
			{ image: prepared }
		);
		expect(mocks.selectStockImage).toHaveBeenCalledWith({ id: "pexels:2", organizationId: "org", userId: "user" });
	});
	it.each([null, { answers: { image: { choice: "none" } } }, { answers: { image: { choice: "invented" } } }])(
		"retains candidates without binding after unavailable or unsuitable selection",
		async (result) => {
			mocks.searchStockImages.mockResolvedValue({
				items: [image("pexels:1", "Tea")],
				nextPage: null,
				partial: false,
			});
			mocks.evaluateDecision.mockResolvedValue(result);
			await expect(
				findImage({ page: 1, purpose: "Coffee hero", query: "coffee" }, context())
			).resolves.toMatchObject({ image: null, items: [expect.objectContaining({ id: "pexels:1" })] });
			expect(mocks.selectStockImage).not.toHaveBeenCalled();
		}
	);
	it("retains web citations and full excerpts when optionally reranking", async () => {
		mocks.search.mockResolvedValue({
			web: [
				{ markdown: "Background", title: "Background", url: "https://example.com/a" },
				{ markdown: "Contrary evidence", title: "Evidence", url: "https://example.com/b" },
			],
		});
		mocks.evaluateDecision.mockResolvedValue({ answers: { c0: { score: 1 }, c1: { score: 3 } } });
		await expect(webSearch({ query: "claim", rerank: true }, context())).resolves.toMatchObject({
			results: [
				{ text: "Contrary evidence", url: "https://example.com/b" },
				{ text: "Background", url: "https://example.com/a" },
			],
		});
	});
	it("ranks by top-level probability mass instead of interpolated score magnitude", () => {
		expect(relevanceRank({ probabilities: { "0": 0.1, "1": 0.2, "2": 0.4, "3": 0.3 }, score: 1.9 })).toBeCloseTo(
			0.7
		);
		expect(relevanceRank({ probabilities: { "0": 0, "1": 0.9, "2": 0.1, "3": 0 }, score: 1.1 })).toBeCloseTo(0.1);
		expect(relevanceRank({ score: 3 })).toBe(1);
		expect(relevanceRank(undefined)).toBe(0);
	});
	it("leaves simple/default searches model-free and retains order on unavailable ranking", async () => {
		const candidates = ["one", "two"];
		await expect(
			rankRelevantCandidates({ candidates, functionId: "test", query: "request", text: (value) => value })
		).resolves.toBe(candidates);
		mocks.evaluateDecision.mockClear();
		await expect(
			rankRelevantCandidates({
				candidates: ["one"],
				functionId: "test",
				query: "request",
				text: (value) => value,
			})
		).resolves.toEqual(["one"]);
		expect(mocks.evaluateDecision).not.toHaveBeenCalled();
		mocks.search.mockResolvedValue({ web: [] });
		await webSearch({ query: "request" }, context());
		expect(mocks.evaluateDecision).not.toHaveBeenCalled();
	});
	it("recommends only eligible catalog patterns and keeps literal filtering deterministic", async () => {
		const preview = templatePreviews.find(({ id }) => id === "nordic-edge");

		if (!preview) {
			throw new Error("Website preview missing");
		}

		mocks.getWebsite.mockResolvedValue({
			publication: { hasUnpublishedChanges: true, publishedAt: null },
			snapshot: { document: preview.document, templateId: preview.id },
			updatedAt: "revision",
			workflow: null,
		});
		mocks.evaluateDecision.mockResolvedValue({ answers: { pattern: { choice: "invented" } } });
		await expect(
			inspect(
				{ category: "contact", index: 0, page: "p0", recommend: "Opening hours and map", scope: "catalog" },
				context()
			)
		).resolves.toMatchObject({ recommendedPattern: null });
		mocks.evaluateDecision.mockClear();
		await inspect({ index: 0, page: "p0", query: "contact", scope: "catalog" }, context());
		expect(mocks.evaluateDecision).not.toHaveBeenCalled();
	});
});
