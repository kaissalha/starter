import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { gateway, wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import { gateway as evaluationGateway } from "ai-evaluation";
import type { RequestLogger } from "evlog";
import { createAIMiddleware } from "evlog/ai";

import { knowledgeEmbeddingDimensions } from "@starter/db/mastra";
import { getRequestLogger } from "@starter/observability";

if (!process.env.AI_GATEWAY_API_KEY) {
	throw new Error("AI_GATEWAY_API_KEY is not set");
}

const requestAIMiddlewares = new WeakMap<RequestLogger, LanguageModelMiddleware>();

const resolveRequestAIMiddleware = () => {
	const requestLog = getRequestLogger();

	if (!requestLog) {
		return undefined;
	}

	const middleware = requestAIMiddlewares.get(requestLog) ?? createAIMiddleware(requestLog);
	requestAIMiddlewares.set(requestLog, middleware);

	return middleware;
};

const requestAIMiddleware: LanguageModelMiddleware = {
	specificationVersion: "v4",
	wrapGenerate: (options) => resolveRequestAIMiddleware()?.wrapGenerate?.(options) ?? options.doGenerate(),
	wrapStream: (options) => resolveRequestAIMiddleware()?.wrapStream?.(options) ?? options.doStream(),
};

const languageModel = (id: string) => wrapLanguageModel({ middleware: requestAIMiddleware, model: gateway(id) });

export const models = {
	cheapFast: {
		model: languageModel("deepseek/deepseek-v4-flash"),
		providerOptions: { gateway: { models: ["google/gemini-3.6-flash"], only: ["baseten", "vertex"] } },
	},
	decision: { model: evaluationGateway.evaluationModel("typesafe-ai/jev") },
	geo: {
		claude: languageModel("anthropic/claude-haiku-4.5"),
		gemini: languageModel("google/gemini-3.6-flash"),
		openai: languageModel("openai/gpt-6-luna"),
	},
	image: { model: gateway.image("openai/gpt-image-2") },
	logo: {
		model: gateway.image("openai/gpt-image-1.5"),
		providerOptions: { openai: { background: "transparent" } },
	},
	vision: { model: languageModel("google/gemini-3.6-flash") },
	websiteAuthoring: { model: languageModel("openai/gpt-6-luna") },
	websiteGeneration: {
		model: languageModel("deepseek/deepseek-v4-flash-0731"),
		providerOptions: {
			deepseek: { thinking: { type: "disabled" } },
			gateway: {
				models: ["google/gemini-3.6-flash"],
				only: ["deepseek", "alibaba", "vertex"],
				order: ["deepseek", "alibaba"],
			},
			google: { thinkingConfig: { thinkingLevel: "minimal" } },
		},
	},
};

export const knowledgeEmbeddingModel = new ModelRouterEmbeddingModel({
	apiKey: process.env.AI_GATEWAY_API_KEY,
	modelId: "google/gemini-embedding-2",
	providerId: "vercel",
	url: "https://ai-gateway.vercel.sh/v1",
});

export const knowledgeEmbeddingProviderOptions = { vercel: { dimensions: knowledgeEmbeddingDimensions } };
