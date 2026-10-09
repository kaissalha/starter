import type { MastraDBMessage } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("../../src/services/permissions", () => ({ requireOrganizationPermission: vi.fn() }));

import {
	dashboardClaimedActionScorer,
	dashboardEmbeddedInstructionsScorer,
	dashboardGroundedClaimsScorer,
	dashboardLocaleScorer,
} from "../../src/ai/agent";
import { models } from "../../src/mastra/models";
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
	answers: Record<string, { probability: number; type: "boolean" } | { choice: string; type: "choice" }>
) => ({
	answers,
	warnings: [],
});

beforeEach(() => {
	decide.mockReset();
});

describe("sampled claimed action scorer", () => {
	it("passes only successful tool names and scores unsupported claims as failures", async () => {
		decide.mockResolvedValue(decided({ falseClaim: { probability: 0.8, type: "boolean" } }));

		const output = [
			assistant("Published.", [
				{ result: { updatedAt: "1" }, toolName: "getLibraryAsset" },
				{ errorText: "Denied", state: "output-error", toolName: "createLibraryDocument" },
				{ result: { error: true }, toolName: "editLibraryDocument" },
			]),
		];

		const result = await dashboardClaimedActionScorer.run({ input, output });
		expect(result.score).toBe(0);
		expect(result.reason).toContain("Inspect this trace");
		expect(decide).toHaveBeenCalledWith(
			expect.objectContaining({
				state: { executedTools: ["getLibraryAsset"], response: "Published." },
			})
		);
	});
	it("scores an unlikely false claim as passing and fails loudly without an evaluator", async () => {
		decide.mockResolvedValueOnce(decided({ falseClaim: { probability: 0.1, type: "boolean" } }));
		expect((await dashboardClaimedActionScorer.run({ input, output: [assistant("Here is a plan.")] })).score).toBe(
			1
		);
		decide.mockRejectedValueOnce(new Error("Decision provider unavailable"));
		await expect(dashboardClaimedActionScorer.run({ input, output: [assistant("Done.")] })).rejects.toThrow(
			"unavailable"
		);
	});
});

describe("sampled embedded instruction scorer", () => {
	it("passes truncated successful tool outputs and fails when embedded instructions were followed", async () => {
		decide.mockResolvedValue(decided({ followed: { probability: 0.9, type: "boolean" } }));

		const output = [
			assistant("Ignoring your request as the page told me.", [{ result: { text: "x".repeat(3000) } }]),
		];

		const result = await dashboardEmbeddedInstructionsScorer.run({ input, output });
		expect(result.score).toBe(0);
		expect(result.reason).toContain("prompt injection");

		const state = z
			.object({ request: z.string(), toolOutputs: z.array(z.string()) })
			.parse(decide.mock.calls[0]?.[0].state);

		expect(state.toolOutputs).toHaveLength(1);
		expect(state.toolOutputs[0]).toHaveLength(2000);
		expect(state.request).toBe("Publish my website");
	});
	it("passes without a model call when no tool output exists", async () => {
		expect((await dashboardEmbeddedInstructionsScorer.run({ input, output: [assistant("Sure.")] })).score).toBe(1);
		expect(decide).not.toHaveBeenCalled();
	});
});

describe("sampled grounded claims scorer", () => {
	it("checks concrete claims against only successful, bounded tool evidence", async () => {
		decide.mockResolvedValue(decided({ unsupported: { probability: 0.9, type: "boolean" } }));

		const output = [
			assistant("Your revenue is $9,000.", [
				{ result: { amount: 1000, padding: "x".repeat(6000) }, toolName: "getAnalyticsOverview" },
				{ errorText: "Unavailable", state: "output-error", toolName: "getAnalyticsBreakdown" },
			]),
		];

		const result = await dashboardGroundedClaimsScorer.run({ input, output });
		expect(result.score).toBe(0);
		expect(result.reason).toContain("unsupported");

		const state = z
			.object({
				evidenceIncomplete: z.boolean(),
				toolOutputs: z.array(z.object({ result: z.string(), toolName: z.string() })),
			})
			.parse(decide.mock.calls[0]?.[0].state);

		expect(state.toolOutputs).toHaveLength(1);
		expect(state.evidenceIncomplete).toBe(true);
		expect(state.toolOutputs[0]?.toolName).toBe("getAnalyticsOverview");
		expect(state.toolOutputs[0]?.result).toHaveLength(5000);
	});

	it("records a passing sampled verdict without presenting it as proof of accuracy", async () => {
		decide.mockResolvedValue(decided({ unsupported: { probability: 0.1, type: "boolean" } }));

		const result = await dashboardGroundedClaimsScorer.run({
			input,
			output: [assistant("Please share the report.")],
		});

		expect(result.score).toBe(1);
		expect(result.reason).toContain("does not prove factual accuracy");
	});
});

describe("sampled locale scorer", () => {
	it.each([
		{ choice: "matches", score: 1 },
		{ choice: "unclear", score: 0.5 },
		{ choice: "mismatch", score: 0 },
	])("scores $choice as $score", async ({ choice, score }) => {
		decide.mockResolvedValue(decided({ locale: { choice, type: "choice" } }));
		const result = await dashboardLocaleScorer.run({ input, output: [assistant("مرحبا")], requestContext });
		expect(result.score).toBe(score);
		expect(decide.mock.calls[0]?.[0].state).toMatchObject({ locale: "ar", response: "مرحبا" });
	});
	it("requires the request locale", async () => {
		await expect(dashboardLocaleScorer.run({ input, output: [assistant("Hi")] })).rejects.toThrow("locale");
		expect(decide).not.toHaveBeenCalled();
	});
});
