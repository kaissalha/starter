import {
	Classifier,
	type ClassifierQuestions,
	type ClassifierState,
	type EvaluationModelResult,
	MastraEvaluationModel,
} from "@mastra/core/classifier";
import { createHash } from "node:crypto";
import { z } from "zod";

import { createTCPRedisClient } from "@starter/cache";
import { log, serializeLogError } from "@starter/observability";

import { models } from "../mastra/models";

type DecisionModelOptions = Parameters<MastraEvaluationModel["doEvaluate"]>[0];

type EvaluationModel = ConstructorParameters<typeof MastraEvaluationModel>[0];

export type DecisionState = ClassifierState;

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
	classifierId,
	modelId,
	questions,
	state,
}: { classifierId: string; modelId: string } & Pick<DecisionModelOptions, "questions" | "state">) =>
	`decision:v1:${classifierId}:${createHash("sha256")
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

const writeMemoizedAnswers = async (key: string, answers: EvaluationModelResult["answers"]) => {
	try {
		await getMemoClient()?.set(key, JSON.stringify(answers), "EX", memoTtlSeconds);
	} catch {
		return;
	}
};

const isConsistentAnswerSet = ({
	answers,
	questions,
}: Pick<DecisionModelOptions, "questions"> & Pick<EvaluationModelResult, "answers">) =>
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

export const decisionModel: EvaluationModel = {
	doEvaluate: async (options) => {
		const result = await models.decision.model.doDecide(options);

		const answers = Object.fromEntries(
			Object.entries(result.answers).map(([id, answer]) => {
				if (answer.type === "refusal") {
					throw new Error(`Decision model refused question ${id}`);
				}

				return [id, answer];
			})
		);

		return { ...result, answers };
	},
	modelId: models.decision.model.modelId,
	provider: models.decision.model.provider,
	specificationVersion: "v4",
	supportedQuestionTypes: models.decision.model.supportedQuestionTypes,
};

class MemoizedDecisionModel extends MastraEvaluationModel {
	readonly #classifierId: string;

	constructor(classifierId: string) {
		super(decisionModel);
		this.#classifierId = classifierId;
	}

	override async doEvaluate(options: DecisionModelOptions): Promise<EvaluationModelResult> {
		const key = memoKey({
			classifierId: this.#classifierId,
			modelId: this.modelId,
			questions: options.questions,
			state: options.state,
		});

		const answers = await readMemoizedAnswers(key);

		if (answers) {
			return { answers, warnings: [] };
		}

		const result = await super.doEvaluate(options);

		if (isConsistentAnswerSet({ answers: result.answers, questions: options.questions })) {
			await writeMemoizedAnswers(key, result.answers);
		}

		return result;
	}
}

const createDecisionClassifier = (id: string, { memoize = false }: { memoize?: boolean } = {}) =>
	new Classifier({ id, model: memoize ? new MemoizedDecisionModel(id) : decisionModel });

export const decisionClassifiers = {
	dashboardRoute: createDecisionClassifier("dashboard-route", { memoize: true }),
	documentCategory: createDecisionClassifier("document-category", { memoize: true }),
	knowledgeCoverage: createDecisionClassifier("knowledge-coverage"),
	knowledgeRelevance: createDecisionClassifier("knowledge-relevance"),
	mediaRelevance: createDecisionClassifier("media-semantic-search"),
	observationGate: createDecisionClassifier("observation-gate"),
	webRelevance: createDecisionClassifier("web-relevance"),
};

export type DecisionClassifier = (typeof decisionClassifiers)[keyof typeof decisionClassifiers];

export const decisionPolicyOptions = ({
	abortSignal,
	policy,
}: {
	abortSignal?: AbortSignal;
	policy: DecisionPolicy;
}) => {
	const { deadlineMs, maxRetries } = decisionPolicies[policy];
	const deadline = AbortSignal.timeout(deadlineMs);

	return { abortSignal: abortSignal ? AbortSignal.any([abortSignal, deadline]) : deadline, maxRetries };
};

export const evaluateDecision = async <const Questions extends ClassifierQuestions>({
	abortSignal,
	classifier,
	policy = "interactive",
	questions,
	state,
}: {
	abortSignal?: AbortSignal;
	classifier: DecisionClassifier;
	policy?: DecisionPolicy;
	questions: Questions;
	state: DecisionState;
}) => {
	abortSignal?.throwIfAborted();
	const startedAt = performance.now();

	if (JSON.stringify(state).length + JSON.stringify(questions).length > decisionStateCharacterBudget) {
		await log.info({ classifierId: classifier.id, message: "Decision skipped: context budget exceeded", policy });

		return null;
	}

	try {
		const result = await classifier.evaluate({
			...decisionPolicyOptions({ abortSignal, policy }),
			questions,
			state,
		});

		const answers = Object.values(result.answers);

		await log.info({
			classifierId: classifier.id,
			elapsedMs: performance.now() - startedAt,
			message: "Decision evaluation completed",
			model: result.response.modelId,
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
			classifierId: classifier.id,
			elapsedMs: performance.now() - startedAt,
			error: serializeLogError(error),
			errorType: error instanceof Error ? error.name : "UnknownError",
			message: "Decision evaluation unavailable; using existing fallback",
			policy,
		});

		return null;
	}
};
