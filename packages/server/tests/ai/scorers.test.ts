import type { MastraDBMessage } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("../../src/services/permissions", () => ({ requireOrganizationPermission: vi.fn() }));

import { dashboardScorers } from "../../src/ai/agent";
import { models } from "../../src/ai/models";
import { createTestToolInvocationParts, type TestToolInvocation as Invocation } from "../helpers/tool-invocations";

const user: MastraDBMessage = {
	content: { format: 2, parts: [{ text: "Publish my website", type: "text" }] },
	createdAt: new Date(),
	id: "user",
	role: "user",
};

const assistant = (text: string, calls: Array<Partial<Invocation>> = []): MastraDBMessage => ({
	content: {
		format: 2,
		parts: [...createTestToolInvocationParts(calls), { text, type: "text" as const }],
	},
	createdAt: new Date(),
	id: "assistant",
	role: "assistant",
});

const input = { inputMessages: [user], rememberedMessages: [], systemMessages: [], taggedSystemMessages: {} };

const requestContext = new RequestContext([["locale", "ar"]]);

const decide = vi.spyOn(models.decision.model, "doDecide");

const decided = (
	answers: Record<
		string,
		{ probability: number; type: "boolean" } | { choice: string; type: "choice" } | { score: number; type: "score" }
	>
) => ({
	answers,
	warnings: [],
});

const decidedState = <T>(schema: z.ZodType<T>) =>
	z.tuple([z.object({ type: z.literal("json"), value: schema })]).parse(decide.mock.calls[0]?.[0].state)[0].value;

beforeEach(() => {
	decide.mockReset();
});

describe("dashboard classifier scorers", () => {
	it("scores action claims against only successful tool names", async () => {
		decide.mockResolvedValue(decided({ accurateActionClaims: { probability: 0.2, type: "boolean" } }));

		const output = [
			assistant("Published.", [
				{ result: { updatedAt: "1" }, toolName: "getLibraryAsset" },
				{ errorText: "Denied", state: "output-error", toolName: "createLibraryDocument" },
				{ result: { error: true }, toolName: "editLibraryDocument" },
			]),
		];

		expect((await dashboardScorers.accurateActionClaims.run({ input, output })).score).toBe(0.2);
		expect(decidedState(z.object({ executedTools: z.array(z.string()), response: z.string() }))).toEqual({
			executedTools: ["getLibraryAsset"],
			response: "Published.",
		});
	});

	it("passes truncated successful tool outputs to the embedded-instruction check", async () => {
		decide.mockResolvedValue(decided({ ignoredEmbeddedInstructions: { probability: 0.9, type: "boolean" } }));

		const output = [assistant("Here is the summary.", [{ result: { text: "x".repeat(3000) } }])];

		expect((await dashboardScorers.ignoredEmbeddedInstructions.run({ input, output })).score).toBe(0.9);

		const state = decidedState(z.object({ request: z.string(), toolOutputs: z.array(z.string()) }));

		expect(state.request).toBe("Publish my website");
		expect(state.toolOutputs).toHaveLength(1);
		expect(state.toolOutputs[0]).toHaveLength(2000);
	});

	it("checks grounding against bounded successful evidence", async () => {
		decide.mockResolvedValue(decided({ grounded: { probability: 0.1, type: "boolean" } }));

		const output = [
			assistant("Your revenue is $9,000.", [
				{ result: { amount: 1000, padding: "x".repeat(6000) }, toolName: "getAnalyticsOverview" },
				{ errorText: "Unavailable", state: "output-error", toolName: "getAnalyticsBreakdown" },
			]),
		];

		expect((await dashboardScorers.grounded.run({ input, output })).score).toBe(0.1);

		const state = decidedState(
			z.object({
				evidenceIncomplete: z.boolean(),
				toolOutputs: z.array(z.object({ result: z.string(), toolName: z.string() })),
			})
		);

		expect(state.evidenceIncomplete).toBe(true);
		expect(state.toolOutputs).toEqual([{ result: expect.any(String), toolName: "getAnalyticsOverview" }]);
		expect(state.toolOutputs[0]?.result).toHaveLength(5000);
	});

	it("normalizes the relevance score", async () => {
		decide.mockResolvedValue(decided({ relevance: { score: 1, type: "score" } }));

		expect((await dashboardScorers.responseRelevance.run({ input, output: [assistant("Done.")] })).score).toBe(0.5);
	});

	it.each([
		{ choice: "matches", score: 1 },
		{ choice: "unclear", score: 0.5 },
		{ choice: "mismatch", score: 0 },
	])("scores locale $choice as $score with the request locale", async ({ choice, score }) => {
		decide.mockResolvedValue(decided({ locale: { choice, type: "choice" } }));

		const result = await dashboardScorers.answeredInUserLocale.run({
			input,
			output: [assistant("مرحبا")],
			requestContext,
		});

		expect(result.score).toBe(score);
		expect(decidedState(z.object({ locale: z.string(), response: z.string() }))).toMatchObject({
			locale: "ar",
			response: "مرحبا",
		});
	});
});
