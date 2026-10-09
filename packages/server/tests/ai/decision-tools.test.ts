import { noopObserve } from "@mastra/core/tools";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	evaluateDecision: vi.fn(),
	requireOrganizationPermission: vi.fn(),
	search: vi.fn(),
}));

vi.mock("../../src/ai/decisions", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/ai/decisions")>()),
	evaluateDecision: mocks.evaluateDecision,
}));

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: mocks.requireOrganizationPermission,
}));

vi.mock("../../src/lib/firecrawl", () => ({ firecrawl: { search: mocks.search } }));

import { decisionClassifiers } from "../../src/ai/decisions";
import { rankRelevantCandidates, relevanceRank } from "../../src/ai/relevance";
import { dashboardSkills, loadDashboardRoute } from "../../src/ai/skills";
import { assistantTools } from "../../src/ai/tools/assistant";
import { createDashboardChatRequestContext } from "../../src/ai/types";

const context = () => ({
	observe: noopObserve,
	requestContext: createDashboardChatRequestContext({ organizationId: "org", userId: "user" }),
});

const classifier = decisionClassifiers.webRelevance;

const webSearch = assistantTools.webSearch.execute;

if (!webSearch) {
	throw new Error("Decision tool handlers are missing");
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireOrganizationPermission.mockResolvedValue("owner");
	mocks.evaluateDecision.mockResolvedValue(null);
});

describe("bounded decision tools", () => {
	it("loads exactly the selected domain and falls back without activation", () => {
		const library = dashboardSkills.find(({ name }) => name === "library");
		expect(loadDashboardRoute("library")).toEqual({ instructions: library?.instructions, skill: "library" });
		expect(loadDashboardRoute("none")).toMatchObject({ skill: null });
		expect(loadDashboardRoute(undefined)).toMatchObject({ skill: null });
	});
	it("retains web citations and full excerpts when optionally reranking", async () => {
		mocks.search.mockResolvedValue({
			web: [
				{ markdown: "Background", title: "Background", url: "https://example.com/a" },
				{ markdown: "Contrary evidence", title: "Evidence", url: "https://example.com/b" },
			],
		});
		mocks.evaluateDecision.mockResolvedValue({
			answers: { c0: { score: 1, type: "score" }, c1: { score: 3, type: "score" } },
		});
		await expect(webSearch({ query: "claim", rerank: true }, context())).resolves.toMatchObject({
			results: [
				{ text: "Contrary evidence", url: "https://example.com/b" },
				{ text: "Background", url: "https://example.com/a" },
			],
		});
	});
	it("ranks by top-level probability mass instead of interpolated score magnitude", () => {
		expect(
			relevanceRank({ probabilities: { "0": 0.1, "1": 0.2, "2": 0.4, "3": 0.3 }, score: 1.9, type: "score" })
		).toBeCloseTo(0.7);
		expect(
			relevanceRank({ probabilities: { "0": 0, "1": 0.9, "2": 0.1, "3": 0 }, score: 1.1, type: "score" })
		).toBeCloseTo(0.1);
		expect(relevanceRank({ score: 3, type: "score" })).toBe(1);
		expect(relevanceRank(undefined)).toBe(0);
	});
	it("leaves simple/default searches model-free and retains order on unavailable ranking", async () => {
		const candidates = ["one", "two"];
		await expect(
			rankRelevantCandidates({ candidates, classifier, query: "request", text: (value) => value })
		).resolves.toEqual(candidates);
		mocks.evaluateDecision.mockClear();
		await expect(
			rankRelevantCandidates({
				candidates: ["one"],
				classifier,
				query: "request",
				text: (value) => value,
			})
		).resolves.toEqual(["one"]);
		expect(mocks.evaluateDecision).not.toHaveBeenCalled();
		mocks.search.mockResolvedValue({ web: [] });
		await webSearch({ query: "request" }, context());
		expect(mocks.evaluateDecision).not.toHaveBeenCalled();
	});
});
