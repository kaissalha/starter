import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { createEvlog } from "evlog/next";
import { describe, expect, it, vi } from "vitest";

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();

	const languageModel = (modelId: string) =>
		new MockLanguageModelV4({
			doGenerate: {
				content: [{ text: "ok", type: "text" }],
				finishReason: { raw: "stop", unified: "stop" },
				usage: {
					inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 12, total: 12 },
					outputTokens: { reasoning: 0, text: 3, total: 3 },
				},
				warnings: [],
			},
			modelId,
			provider: "gateway",
		});

	return { ...actual, gateway: Object.assign(languageModel, { decisionModel: vi.fn(), image: vi.fn() }) };
});

const { models } = await import("../../src/ai/models");

describe("models", () => {
	it("records AI usage on the active request wide event", async () => {
		const { useLogger, withEvlog } = createEvlog({ silent: true });

		const context = await withEvlog(async () => {
			await generateText({ model: models.cheapFast.model, prompt: "hi" });
			await generateText({ model: models.vision.model, prompt: "hi" });

			// oxlint-disable-next-line react/rules-of-hooks -- evlog useLogger is request-local, not a React Hook
			return useLogger().getContext();
		})();

		expect(context.ai).toMatchObject({ calls: 2, inputTokens: 24, outputTokens: 6, totalTokens: 30 });
	});

	it("generates normally outside a request", async () => {
		await expect(generateText({ model: models.cheapFast.model, prompt: "hi" })).resolves.toMatchObject({
			text: "ok",
		});
	});
});
