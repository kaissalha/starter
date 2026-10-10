import {
	Classifier,
	type ClassifierQuestions,
	type ClassifierState,
	type MastraEvaluationModel,
} from "@mastra/core/classifier";

import { log, serializeLogError } from "@starter/observability";

import { models } from "./models";

export const decisionPolicies = {
	background: { deadlineMs: 8000, maxRetries: 1 },
	interactive: { deadlineMs: 2000, maxRetries: 0 },
};

export const decisionStateCharacterBudget = 32_000;

export const decisionModel: ConstructorParameters<typeof MastraEvaluationModel>[0] = {
	doEvaluate: async (options) => {
		const result = await models.decision.model.doDecide({
			...options,
			state: [{ type: "json", value: options.state }],
		});

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

const decisionClassifier = (id: string) => new Classifier({ id, model: decisionModel });

export const decisionClassifiers = {
	documentCategory: decisionClassifier("document-category"),
	knowledgeCoverage: decisionClassifier("knowledge-coverage"),
	knowledgeRelevance: decisionClassifier("knowledge-relevance"),
	mediaRelevance: decisionClassifier("media-semantic-search"),
	observationGate: decisionClassifier("observation-gate"),
	webRelevance: decisionClassifier("web-relevance"),
};

export type DecisionClassifier = Classifier;

export const evaluateDecision = async <const Questions extends ClassifierQuestions>({
	abortSignal,
	classifier,
	policy = "interactive",
	questions,
	state,
}: {
	abortSignal?: AbortSignal;
	classifier: Classifier;
	policy?: keyof typeof decisionPolicies;
	questions: Questions;
	state: ClassifierState;
}) => {
	abortSignal?.throwIfAborted();

	if (JSON.stringify(state).length + JSON.stringify(questions).length > decisionStateCharacterBudget) {
		return null;
	}

	const { deadlineMs, maxRetries } = decisionPolicies[policy];
	const deadline = AbortSignal.timeout(deadlineMs);

	try {
		return await classifier.evaluate({
			abortSignal: abortSignal ? AbortSignal.any([abortSignal, deadline]) : deadline,
			maxRetries,
			questions,
			state,
		});
	} catch (error) {
		abortSignal?.throwIfAborted();
		await log.warn({
			classifierId: classifier.id,
			error: serializeLogError(error),
			message: "Decision evaluation unavailable; using existing fallback",
			policy,
		});

		return null;
	}
};
