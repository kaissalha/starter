import { afterEach, describe, expect, it, vi } from "vitest";

import type { models } from "../../src/mastra/models";

type DoDecide = (typeof models)["decision"]["model"]["doDecide"];

type DecisionAnswers = Awaited<ReturnType<DoDecide>>["answers"];

const decisionModel = vi.hoisted(() => ({
	doDecide: vi.fn<DoDecide>(),
	modelId: "test-decision",
	provider: "test",
	specificationVersion: "v4" as const,
	supportedQuestionTypes: ["boolean" as const, "choice" as const, "score" as const],
}));

vi.mock("../../src/mastra/models", () => ({ models: { decision: { model: decisionModel } } }));

const redis = vi.hoisted(() => {
	const store = new Map<string, string>();

	return {
		client: {
			get: vi.fn(async (key: string) => store.get(key) ?? null),
			on: vi.fn(),
			set: vi.fn(async (key: string, value: string) => {
				store.set(key, value);

				return "OK";
			}),
			status: "ready",
		},
		store,
	};
});

vi.mock("@starter/cache", () => ({ createTCPRedisClient: vi.fn(() => redis.client) }));

import { decisionClassifiers, evaluateDecision } from "../../src/ai/decisions";

const questions = {
	route: {
		criteria: { none: "No match", website: "Website" },
		instructions: "Choose the matching route.",
		type: "choice" as const,
	},
};

const decided = (answers: DecisionAnswers) => ({ answers, warnings: [] });

const classifier = decisionClassifiers.knowledgeCoverage;

const memoizedClassifier = decisionClassifiers.dashboardRoute;

const pendingDecision: DoDecide = ({ abortSignal }) =>
	new Promise<never>((_resolve, reject) => {
		abortSignal?.addEventListener("abort", () => reject(abortSignal.reason), { once: true });
	});

describe("bounded decision evaluation", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		decisionModel.doDecide.mockReset();
		vi.useRealTimers();
		vi.unstubAllEnvs();
		redis.store.clear();
	});

	it("uses the background policy deadline when requested", async () => {
		const timeout = vi.spyOn(AbortSignal, "timeout");

		decisionModel.doDecide.mockResolvedValue(decided({ route: { choice: "none", type: "choice" } }));

		const result = await evaluateDecision({
			classifier,
			policy: "background",
			questions,
			state: { text: "test" },
		});

		expect(result?.answers.route.choice).toBe("none");
		expect(timeout).toHaveBeenCalledWith(8000);
	});

	it("memoizes consistent answers per memoized classifier and skips the provider on a hit", async () => {
		vi.stubEnv("REDIS_URL", "redis://memo.test:6379");
		decisionModel.doDecide.mockResolvedValue(decided({ route: { choice: "website", type: "choice" } }));

		const request = { classifier: memoizedClassifier, questions, state: "same" };
		await evaluateDecision(request);
		const second = await evaluateDecision(request);
		expect(second?.answers.route.choice).toBe("website");
		expect(decisionModel.doDecide).toHaveBeenCalledOnce();
		expect([...redis.store.keys()][0]).toMatch(/^decision:v1:dashboard-route:/u);
		await evaluateDecision({ ...request, classifier });
		await evaluateDecision({ ...request, state: "different" });
		expect(decisionModel.doDecide).toHaveBeenCalledTimes(3);
	});

	it("never memoizes answers that fail the question contract", async () => {
		vi.stubEnv("REDIS_URL", "redis://memo.test:6379");

		decisionModel.doDecide.mockResolvedValue(decided({ route: { choice: "invented", type: "choice" } }));

		expect(await evaluateDecision({ classifier: memoizedClassifier, questions, state: "s" })).toBeNull();
		expect(redis.store.size).toBe(0);
	});

	it("returns a valid finite answer without retries", async () => {
		decisionModel.doDecide.mockResolvedValue(decided({ route: { choice: "website", type: "choice" } }));

		const result = await evaluateDecision({ classifier, questions, state: "test" });

		expect(result?.answers.route.choice).toBe("website");
		expect(decisionModel.doDecide).toHaveBeenCalledOnce();
	});

	it.each([
		decided({ route: { choice: "invented", type: "choice" } }),
		decided({ route: { score: 1, type: "score" } }),
		decided({ route: { type: "refusal" } }),
		decided({}),
	])("rejects invalid or refused provider answers", async (response) => {
		decisionModel.doDecide.mockResolvedValue(response);

		expect(await evaluateDecision({ classifier, questions, state: "test" })).toBeNull();
	});

	it("skips oversized state before calling a provider", async () => {
		expect(await evaluateDecision({ classifier, questions, state: "x".repeat(32_001) })).toBeNull();
		expect(decisionModel.doDecide).not.toHaveBeenCalled();
	});

	it("falls back on provider failure", async () => {
		decisionModel.doDecide.mockRejectedValue(new Error("provider unavailable"));
		expect(await evaluateDecision({ classifier, questions, state: "test" })).toBeNull();
		expect(decisionModel.doDecide).toHaveBeenCalledOnce();
	});

	it("propagates caller cancellation instead of returning a decision fallback", async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(
			evaluateDecision({ abortSignal: controller.signal, classifier, questions, state: "test" })
		).rejects.toThrow("aborted");
		expect(decisionModel.doDecide).not.toHaveBeenCalled();
	});

	it("aborts an in-flight provider at the two-second deadline without retrying", async () => {
		const deadline = new AbortController();
		const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
		decisionModel.doDecide.mockImplementation(pendingDecision);

		const pending = evaluateDecision({ classifier, questions, state: "test" });

		await vi.waitFor(() => expect(decisionModel.doDecide).toHaveBeenCalledOnce());
		expect(timeout).toHaveBeenCalledWith(2000);
		deadline.abort(new DOMException("Decision deadline elapsed", "TimeoutError"));
		await expect(pending).resolves.toBeNull();
		expect(decisionModel.doDecide).toHaveBeenCalledOnce();
	});

	it("propagates caller cancellation while a provider request is in flight", async () => {
		const controller = new AbortController();
		decisionModel.doDecide.mockImplementation(pendingDecision);

		const pending = evaluateDecision({ abortSignal: controller.signal, classifier, questions, state: "test" });

		await vi.waitFor(() => expect(decisionModel.doDecide).toHaveBeenCalledOnce());
		controller.abort(new DOMException("User cancelled the request", "AbortError"));
		await expect(pending).rejects.toThrow("User cancelled the request");
		expect(decisionModel.doDecide).toHaveBeenCalledOnce();
	});
});
