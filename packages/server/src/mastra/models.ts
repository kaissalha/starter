import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { gateway, wrapLanguageModel, type LanguageModelMiddleware } from "ai";
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
	chat: { model: languageModel("openai/gpt-6-luna") },
	cheapFast: {
		model: languageModel("deepseek/deepseek-v4-flash"),
		providerOptions: { gateway: { models: ["google/gemini-3.6-flash"], only: ["baseten", "vertex"] } },
	},
	decision: { model: gateway.decisionModel("typesafe-ai/jev") },
	image: { model: gateway.image("openai/gpt-image-2") },
	logo: {
		model: gateway.image("openai/gpt-image-1.5"),
		providerOptions: { openai: { background: "transparent" } },
	},
	vision: { model: languageModel("google/gemini-3.6-flash") },
};

export const knowledgeEmbeddingModelConfig = {
	apiKey: process.env.AI_GATEWAY_API_KEY,
	modelId: "google/gemini-embedding-2",
	providerId: "vercel",
	url: "https://ai-gateway.vercel.sh/v1",
};

export const knowledgeEmbeddingModel = new ModelRouterEmbeddingModel(knowledgeEmbeddingModelConfig);

export const knowledgeEmbeddingProviderOptions = { vercel: { dimensions: knowledgeEmbeddingDimensions } };
