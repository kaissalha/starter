import { z } from "zod";

const modelsResponseSchema = z.object({
	data: z.array(
		z.object({
			id: z.string(),
			pricing: z
				.object({
					input: z.string().optional(),
					input_cache_read: z.string().optional(),
					output: z.string().optional(),
				})
				.optional(),
		})
	),
});

export type Pricing = { cacheRead: number; input: number; output: number };

export type Usage = { cachedInputTokens?: number; inputTokens?: number; outputTokens?: number };

const cache = new Map<"models", Promise<Map<string, Pricing>>>();

const loadPricing = async () => {
	try {
		const response = await fetch("https://ai-gateway.vercel.sh/v1/models");
		const parsed = modelsResponseSchema.parse(await response.json());

		return new Map(
			parsed.data.flatMap(({ id, pricing }) =>
				pricing?.input && pricing.output
					? [
							[
								id,
								{
									cacheRead: Number(pricing.input_cache_read ?? pricing.input),
									input: Number(pricing.input),
									output: Number(pricing.output),
								},
							] as const,
						]
					: []
			)
		);
	} catch {
		return new Map<string, Pricing>();
	}
};

export const getPricing = async (modelId: string) => {
	const loaded = cache.get("models") ?? loadPricing();
	cache.set("models", loaded);

	return (await loaded).get(modelId) ?? null;
};

export const estimateCostUsd = ({ pricing, usage }: { pricing: Pricing | null; usage: Usage }) => {
	if (!pricing) {
		return null;
	}

	const cached = usage.cachedInputTokens ?? 0;
	const uncached = Math.max(0, (usage.inputTokens ?? 0) - cached);

	return uncached * pricing.input + cached * pricing.cacheRead + (usage.outputTokens ?? 0) * pricing.output;
};
