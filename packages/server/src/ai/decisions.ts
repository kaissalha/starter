import type { ToolObserve } from "@mastra/core/tools";
import {
	experimental_evaluate as evaluate,
	type Experimental_EvaluationModel,
	type Experimental_EvaluationQuestion,
} from "ai-evaluation";
import { createHash } from "node:crypto";
import { z } from "zod";

import { createTCPRedisClient } from "@starter/cache";
import { log, serializeLogError } from "@starter/observability";

import { models } from "../mastra/models";

type EvaluationModel = Exclude<Experimental_EvaluationModel, string>;

type EvaluationCallOptions = Parameters<EvaluationModel["doEvaluate"]>[0];

type EvaluationCallResult = Awaited<ReturnType<EvaluationModel["doEvaluate"]>>;

export type DecisionState = EvaluationCallOptions["state"];

export const decisionPolicies = {
	background: { deadlineMs: 8000, maxRetries: 1 },
	interactive: { deadlineMs: 2000, maxRetries: 0 },
};

export type DecisionPolicy = keyof typeof decisionPolicies;

export const decisionStateCharacterBudget = 32_000;

const memoTtlSeconds = 3600;

const probabilitiesSchema = z.record(z.string(), z.number()).optional();

const memoizedAnswersSchema = z.compile(
	z.record(
		z.string(),
		z.union([
			z.object({ choice: z.string(), probabilities: probabilitiesSchema, type: z.literal("choice") }),
			z.object({ probabilities: probabilitiesSchema, score: z.number(), type: z.literal("score") }),
			z.object({ probability: z.number(), type: z.literal("boolean") }),
		])
	)
);

type MemoClient = { value?: ReturnType<typeof createTCPRedisClient> };

const memoClient: MemoClient = {};

const getMemoClient = () => {
	if (!process.env.REDIS_URL) {
		return null;
	}

	if (!memoClient.value || memoClient.value.status === "end") {
		memoClient.value = createTCPRedisClient(process.env.REDIS_URL, {
			commandTimeout: 300,
			connectTimeout: 300,
			enableOfflineQueue: true,
			maxRetriesPerRequest: 0,
			retryStrategy: () => null,
		});
		memoClient.value.on("error", () => undefined);
	}

	return memoClient.value;
};

const memoKey = ({
	functionId,
	modelId,
	questions,
	state,
}: { functionId: string; modelId: string } & Pick<EvaluationCallOptions, "questions" | "state">) =>
	`decision:v1:${functionId}:${createHash("sha256")
		.update(JSON.stringify([modelId, questions, state]))
		.digest("hex")}`;

const readMemoizedAnswers = async (key: string) => {
	try {
		const value = await getMemoClient()?.get(key);

		return value ? memoizedAnswersSchema.safeParse(JSON.parse(value)).data : undefined;
	} catch {
		return undefined;
	}
};

const writeMemoizedAnswers = async (key: string, answers: EvaluationCallResult["answers"]) => {
	try {
		await getMemoClient()?.set(key, JSON.stringify(answers), "EX", memoTtlSeconds);
	} catch {
		return;
	}
};

const isConsistentAnswerSet = ({
	answers,
	questions,
}: Pick<EvaluationCallOptions, "questions"> & Pick<EvaluationCallResult, "answers">) =>
	Object.keys(questions).length === Object.keys(answers).length &&
	Object.entries(questions).every(([id, question]) => {
		const answer = answers[id];

		if (!answer || answer.type !== question.type) {
			return false;
		}

		if (answer.type === "choice" && question.type === "choice") {
			return answer.choice in question.criteria;
		}

		if (answer.type === "score" && question.type === "score") {
			return answer.score >= 0 && answer.score <= question.criteria.length - 1;
		}

		return answer.type === "boolean" && answer.probability >= 0 && answer.probability <= 1;
	});

const memoizeEvaluationModel = ({
	functionId,
	model,
	onHit,
}: {
	functionId: string;
	model: EvaluationModel;
	onHit: () => void;
}): EvaluationModel => ({
	doEvaluate: async (options) => {
		const key = memoKey({ functionId, modelId: model.modelId, questions: options.questions, state: options.state });
		const answers = await readMemoizedAnswers(key);

		if (answers) {
			onHit();

			return { answers, warnings: [] };
		}

		const result = await model.doEvaluate(options);

		if (isConsistentAnswerSet({ answers: result.answers, questions: options.questions })) {
			await writeMemoizedAnswers(key, result.answers);
		}

		return result;
	},
	modelId: model.modelId,
	provider: model.provider,
	specificationVersion: "v4",
	supportedQuestionTypes: model.supportedQuestionTypes,
});

export const evaluateDecision = async <const Questions extends Record<string, Experimental_EvaluationQuestion>>({
	abortSignal,
	functionId,
	memoize = false,
	model = models.decision.model,
	observe,
	policy = "interactive",
	questions,
	state,
}: {
	abortSignal?: AbortSignal;
	functionId: string;
	memoize?: boolean;
	model?: EvaluationModel;
	observe?: Pick<ToolObserve, "span">;
	policy?: DecisionPolicy;
	questions: Questions;
	state: DecisionState;
}) => {
	abortSignal?.throwIfAborted();
	const startedAt = performance.now();

	if (JSON.stringify(state).length + JSON.stringify(questions).length > decisionStateCharacterBudget) {
		await log.info({ functionId, message: "Decision skipped: context budget exceeded", policy });

		return null;
	}

	const { deadlineMs, maxRetries } = decisionPolicies[policy];
	const memo = { hit: false };

	try {
		const deadline = AbortSignal.timeout(deadlineMs);

		const run = () =>
			evaluate({
				abortSignal: abortSignal ? AbortSignal.any([abortSignal, deadline]) : deadline,
				maxRetries,
				model: memoize
					? memoizeEvaluationModel({
							functionId,
							model,
							onHit: () => {
								memo.hit = true;
							},
						})
					: model,
				questions,
				state,
			});

		const result = await (observe ? observe.span(functionId, run) : run());
		const answers = Object.values(result.answers);
		await log.info({
			cached: memo.hit,
			elapsedMs: performance.now() - startedAt,
			functionId,
			message: "Decision evaluation completed",
			model: model.modelId,
			policy,
			probabilitiesMissing: answers.filter((answer) => answer.type !== "boolean" && !answer.probabilities).length,
			questionCount: answers.length,
			usage: result.usage,
			warnings: result.warnings.length > 0 ? result.warnings : undefined,
		});

		return result;
	} catch (error) {
		abortSignal?.throwIfAborted();
		await log.warn({
			elapsedMs: performance.now() - startedAt,
			error: serializeLogError(error),
			errorType: error instanceof Error ? error.name : "UnknownError",
			functionId,
			message: "Decision evaluation unavailable; using existing fallback",
			policy,
		});

		return null;
	}
};
