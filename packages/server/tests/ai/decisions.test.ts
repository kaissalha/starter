import type { Experimental_EvaluationModel } from "ai-evaluation";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { evaluateDecision } from "../../src/ai/decisions";

const questions = {
	route: {
		criteria: { none: "No match", website: "Website" },
		instructions: "Choose the matching route.",
		type: "choice" as const,
	},
};

const createModel = (doEvaluate: Exclude<Experimental_EvaluationModel, string>["doEvaluate"]) => ({
	doEvaluate,
	modelId: "test-decision",
	provider: "test",
	specificationVersion: "v4" as const,
	supportedQuestionTypes: ["choice" as const],
});

const createPendingEvaluation = () =>
	vi.fn<Exclude<Experimental_EvaluationModel, string>["doEvaluate"]>(
		({ abortSignal }) =>
			new Promise<never>((_resolve, reject) => {
				abortSignal?.addEventListener("abort", () => reject(abortSignal.reason), { once: true });
			})
	);

describe("bounded decision evaluation", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
		vi.unstubAllEnvs();
		redis.store.clear();
	});

	it("uses the background policy deadline when requested", async () => {
		const timeout = vi.spyOn(AbortSignal, "timeout");

		const doEvaluate = vi
			.fn()
			.mockResolvedValue({ answers: { route: { choice: "none", type: "choice" } }, warnings: [] });

		const result = await evaluateDecision({
			functionId: "test",
			model: createModel(doEvaluate),
			policy: "background",
			questions,
			state: { text: "test" },
		});

		expect(result?.answers.route.choice).toBe("none");
		expect(timeout).toHaveBeenCalledWith(8000);
	});

	it("memoizes consistent answers per function and skips the provider on a hit", async () => {
		vi.stubEnv("REDIS_URL", "redis://memo.test:6379");

		const doEvaluate = vi
			.fn()
			.mockResolvedValue({ answers: { route: { choice: "website", type: "choice" } }, warnings: [] });

		const request = { functionId: "memo", memoize: true, model: createModel(doEvaluate), questions, state: "same" };
		await evaluateDecision(request);
		const second = await evaluateDecision(request);
		expect(second?.answers.route.choice).toBe("website");
		expect(doEvaluate).toHaveBeenCalledOnce();
		expect([...redis.store.keys()][0]).toMatch(/^decision:v1:memo:/u);
		await evaluateDecision({ ...request, functionId: "other" });
		await evaluateDecision({ ...request, state: "different" });
		expect(doEvaluate).toHaveBeenCalledTimes(3);
	});

	it("never memoizes answers that fail the question contract", async () => {
		vi.stubEnv("REDIS_URL", "redis://memo.test:6379");

		const doEvaluate = vi
			.fn()
			.mockResolvedValue({ answers: { route: { choice: "invented", type: "choice" } }, warnings: [] });

		expect(
			await evaluateDecision({
				functionId: "memo",
				memoize: true,
				model: createModel(doEvaluate),
				questions,
				state: "s",
			})
		).toBeNull();
		expect(redis.store.size).toBe(0);
	});

	it("returns a valid finite answer without retries", async () => {
		const doEvaluate = vi
			.fn()
			.mockResolvedValue({ answers: { route: { choice: "website", type: "choice" } }, warnings: [] });

		const result = await evaluateDecision({
			functionId: "test",
			model: createModel(doEvaluate),
			questions,
			state: "test",
		});

		expect(result?.answers.route.choice).toBe("website");
		expect(doEvaluate).toHaveBeenCalledOnce();
	});

	it.each([
		{ answers: { route: { choice: "invented", type: "choice" } }, warnings: [] },
		{ answers: { route: { score: 1, type: "score" } }, warnings: [] },
		{ answers: {}, warnings: [] },
	])("rejects invalid provider answers", async (response) => {
		const result = await evaluateDecision({
			functionId: "test",
			model: createModel(vi.fn().mockResolvedValue(response)),
			questions,
			state: "test",
		});

		expect(result).toBeNull();
	});

	it("skips oversized state before calling a provider", async () => {
		const doEvaluate = vi.fn();
		expect(
			await evaluateDecision({
				functionId: "test",
				model: createModel(doEvaluate),
				questions,
				state: "x".repeat(32_001),
			})
		).toBeNull();
		expect(doEvaluate).not.toHaveBeenCalled();
	});

	it("falls back on provider failure", async () => {
		const doEvaluate = vi.fn().mockRejectedValue(new Error("provider unavailable"));
		expect(
			await evaluateDecision({ functionId: "test", model: createModel(doEvaluate), questions, state: "test" })
		).toBeNull();
		expect(doEvaluate).toHaveBeenCalledOnce();
	});

	it("propagates caller cancellation instead of returning a decision fallback", async () => {
		const controller = new AbortController();
		controller.abort();
		const doEvaluate = vi.fn();
		await expect(
			evaluateDecision({
				abortSignal: controller.signal,
				functionId: "test",
				model: createModel(doEvaluate),
				questions,
				state: "test",
			})
		).rejects.toThrow("aborted");
		expect(doEvaluate).not.toHaveBeenCalled();
	});

	it("aborts an in-flight provider at the two-second deadline without retrying", async () => {
		const deadline = new AbortController();
		const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
		const doEvaluate = createPendingEvaluation();

		const pending = evaluateDecision({
			functionId: "test",
			model: createModel(doEvaluate),
			questions,
			state: "test",
		});

		await vi.waitFor(() => expect(doEvaluate).toHaveBeenCalledOnce());
		expect(timeout).toHaveBeenCalledWith(2000);
		deadline.abort(new DOMException("Decision deadline elapsed", "TimeoutError"));
		await expect(pending).resolves.toBeNull();
		expect(doEvaluate).toHaveBeenCalledOnce();
	});

	it("propagates caller cancellation while a provider request is in flight", async () => {
		const controller = new AbortController();
		const doEvaluate = createPendingEvaluation();

		const pending = evaluateDecision({
			abortSignal: controller.signal,
			functionId: "test",
			model: createModel(doEvaluate),
			questions,
			state: "test",
		});

		await vi.waitFor(() => expect(doEvaluate).toHaveBeenCalledOnce());
		controller.abort(new DOMException("User cancelled the request", "AbortError"));
		await expect(pending).rejects.toThrow("User cancelled the request");
		expect(doEvaluate).toHaveBeenCalledOnce();
	});
});
