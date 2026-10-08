import { z } from "zod";

import type { ResolvedAsset } from "@starter/infinite-website/contracts";

import { stockImageProviders } from "./stock-image-providers";

export const stockImageSchema = z.object({
	alt: z.string(),
	height: z.number().int().positive(),
	hotlinkUrl: z.url(),
	id: z.string(),
	provider: z.string(),
	sources: z.array(z.object({ src: z.url(), width: z.number().int().positive() })),
	thumbnailUrl: z.url(),
	width: z.number().int().positive(),
});

export const stockImageSearchInputSchema = z.object({
	orientation: z.enum(["landscape", "portrait", "square"]).optional(),
	page: z.number().int().min(1).max(100).default(1),
	query: z.string().trim().min(1).max(100),
});

export const stockImageSearchResultSchema = z.object({
	items: z.array(stockImageSchema),
	nextPage: z.number().nullable(),
	partial: z.boolean(),
});

export const stockImageSelectInputSchema = z.object({ id: z.string().min(1).max(200) });

export type StockImageCandidate = z.infer<typeof stockImageSchema> & { trackingUrl?: string };

export type StockImageRequest = {
	fetcher: typeof fetch;
	signal: AbortSignal;
};

export type StockImageProvider = {
	get: (input: StockImageRequest & { id: string }) => Promise<StockImageCandidate>;
	id: string;
	imageHost: string;
	search: (
		input: StockImageRequest & z.infer<typeof stockImageSearchInputSchema>
	) => Promise<{ hasMore: boolean; items: Array<StockImageCandidate> }>;
	trackSelection?: (input: StockImageRequest & { candidate: StockImageCandidate }) => Promise<void>;
};

export const searchStockImages = async ({
	fetcher = fetch,
	orientation,
	page = 1,
	query,
	signal,
}: Omit<z.infer<typeof stockImageSearchInputSchema>, "page"> & {
	fetcher?: typeof fetch;
	page?: number;
	signal?: AbortSignal;
}) => {
	const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);

	const results = await Promise.allSettled(
		stockImageProviders.map((provider) =>
			provider.search({ fetcher, orientation, page, query, signal: requestSignal })
		)
	);

	signal?.throwIfAborted();
	const successful = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

	if (successful.length === 0) {
		throw new AggregateError(
			results.flatMap((result) => (result.status === "rejected" ? [result.reason] : [])),
			"Stock photo search is unavailable"
		);
	}

	const items = Array.from({ length: Math.max(0, ...successful.map((result) => result.items.length)) }, (_, index) =>
		successful.flatMap((result) => (result.items[index] ? [result.items[index]] : []))
	).flat();

	return {
		items: [...new Map(items.map((item) => [item.hotlinkUrl, item])).values()],
		nextPage: page < 100 && successful.some((result) => result.hasMore) ? page + 1 : null,
		partial: successful.length < results.length,
	};
};

export const getStockImage = async ({
	fetcher = fetch,
	id,
	signal = AbortSignal.timeout(8000),
}: {
	fetcher?: typeof fetch;
	id: string;
	signal?: AbortSignal;
}) => {
	const separator = id.indexOf(":");
	const provider = stockImageProviders.find((item) => item.id === id.slice(0, separator));
	const photoId = id.slice(separator + 1);

	if (!provider || !/^[\w-]+$/.test(photoId)) {
		throw new Error("Invalid stock photo ID");
	}

	return provider.get({ fetcher, id: photoId, signal });
};

export const bindStockImageCandidate = async ({
	candidate,
	fetcher = fetch,
	loading = "lazy",
	signal = AbortSignal.timeout(8000),
}: {
	candidate: StockImageCandidate;
	fetcher?: typeof fetch;
	loading?: "eager" | "lazy";
	signal?: AbortSignal;
}) => {
	const provider = stockImageProviders.find((item) => item.id === candidate.provider);

	const supported = [candidate.hotlinkUrl, ...candidate.sources.map((source) => source.src)].every((src) => {
		const url = new URL(src);

		return url.protocol === "https:" && url.hostname === provider?.imageHost;
	});

	if (!provider || !supported) {
		throw new Error("Stock provider returned an unsupported image host");
	}

	await provider.trackSelection?.({ candidate, fetcher, signal });

	return {
		decoding: "async",
		height: candidate.height,
		loading,
		sizes: "100vw",
		sources: candidate.sources,
		src: candidate.hotlinkUrl,
		type: "image",
		width: candidate.width,
	} satisfies ResolvedAsset;
};
