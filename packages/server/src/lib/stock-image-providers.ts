import { z } from "zod";

import type { StockImageCandidate, StockImageProvider, StockImageRequest } from "./stock-images";

const unsplashPhotoSchema = z.object({
	alt_description: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	height: z.number().int().positive(),
	id: z.string(),
	links: z.object({ download_location: z.url() }),
	urls: z.object({ regular: z.url(), small: z.url() }),
	width: z.number().int().positive(),
});

const pexelsPhotoSchema = z.object({
	alt: z.string(),
	height: z.number().int().positive(),
	id: z.number().int(),
	src: z.object({ original: z.url() }),
	width: z.number().int().positive(),
});

const unsplashCandidate = (photo: z.infer<typeof unsplashPhotoSchema>): StockImageCandidate => {
	const width = Math.min(photo.width, 1080);

	return {
		alt: photo.alt_description ?? photo.description ?? "",
		height: Math.max(1, Math.round((photo.height * width) / photo.width)),
		hotlinkUrl: photo.urls.regular,
		id: `unsplash:${photo.id}`,
		provider: "unsplash",
		sources: [
			...new Map(
				[
					{ src: photo.urls.small, width: Math.min(photo.width, 400) },
					{ src: photo.urls.regular, width },
				].map((source) => [source.width, source])
			).values(),
		],
		thumbnailUrl: photo.urls.small,
		trackingUrl: photo.links.download_location,
		width,
	};
};

const pexelsDeliveryUrl = ({ src, width }: { src: string; width: number }) => {
	const url = new URL(src);

	for (const key of ["dpr", "fit", "h"]) {
		url.searchParams.delete(key);
	}

	url.searchParams.set("auto", "compress");
	url.searchParams.set("cs", "tinysrgb");
	url.searchParams.set("w", String(width));

	return url.href;
};

const pexelsCandidate = (photo: z.infer<typeof pexelsPhotoSchema>): StockImageCandidate => {
	const width = Math.min(photo.width, 1200);

	return {
		alt: photo.alt,
		height: Math.max(1, Math.round((photo.height * width) / photo.width)),
		hotlinkUrl: pexelsDeliveryUrl({ src: photo.src.original, width }),
		id: `pexels:${photo.id}`,
		provider: "pexels",
		sources: [...new Set([400, 800, width])]
			.filter((size) => size <= width)
			.toSorted((a, b) => a - b)
			.map((size) => ({ src: pexelsDeliveryUrl({ src: photo.src.original, width: size }), width: size })),
		thumbnailUrl: pexelsDeliveryUrl({ src: photo.src.original, width: Math.min(photo.width, 400) }),
		width,
	};
};

const unsplashRequest = async ({ fetcher, signal, url }: StockImageRequest & { url: URL }) => {
	const key = process.env.UNSPLASH_ACCESS_KEY;

	if (!key) {
		throw new Error("Unsplash is not configured");
	}

	if (url.protocol !== "https:" || url.hostname !== "api.unsplash.com") {
		throw new Error("Unsplash returned an unsupported tracking host");
	}

	const response = await fetcher(url, {
		headers: { "Accept-Version": "v1", Authorization: `Client-ID ${key}` },
		signal,
	});

	if (!response.ok) {
		throw new Error(`Unsplash request failed with status ${response.status}`);
	}

	return response;
};

const pexelsRequest = async ({ fetcher, signal, url }: StockImageRequest & { url: URL }) => {
	const key = process.env.PEXELS_API_KEY;

	if (!key) {
		throw new Error("Pexels is not configured");
	}

	const response = await fetcher(url, { headers: { Authorization: key }, signal });

	if (!response.ok) {
		throw new Error(`Pexels request failed with status ${response.status}`);
	}

	return response;
};

const unsplash: StockImageProvider = {
	get: async ({ id, ...request }) => {
		const response = await unsplashRequest({
			...request,
			url: new URL(`https://api.unsplash.com/photos/${encodeURIComponent(id)}`),
		});

		return unsplashCandidate(unsplashPhotoSchema.parse(await response.json()));
	},
	id: "unsplash",
	imageHost: "images.unsplash.com",
	search: async ({ orientation, page, query, ...request }) => {
		const url = new URL("https://api.unsplash.com/search/photos");
		url.searchParams.set("query", query);
		url.searchParams.set("page", String(page));

		if (orientation) {
			url.searchParams.set("orientation", orientation === "square" ? "squarish" : orientation);
		}

		url.searchParams.set("content_filter", "high");
		url.searchParams.set("per_page", "30");
		const response = await unsplashRequest({ ...request, url });

		const data = z
			.object({ results: z.array(unsplashPhotoSchema), total_pages: z.number() })
			.parse(await response.json());

		return { hasMore: page < data.total_pages, items: data.results.map(unsplashCandidate) };
	},
	trackSelection: async ({ candidate, ...request }) => {
		if (!candidate.trackingUrl) {
			throw new Error("Stock photo is missing download tracking");
		}

		await unsplashRequest({ ...request, url: new URL(candidate.trackingUrl) });
	},
};

const pexels: StockImageProvider = {
	get: async ({ id, ...request }) => {
		const response = await pexelsRequest({
			...request,
			url: new URL(`https://api.pexels.com/v1/photos/${encodeURIComponent(id)}`),
		});

		return pexelsCandidate(pexelsPhotoSchema.parse(await response.json()));
	},
	id: "pexels",
	imageHost: "images.pexels.com",
	search: async ({ orientation, page, query, ...request }) => {
		const url = new URL("https://api.pexels.com/v1/search");
		url.searchParams.set("query", query);
		url.searchParams.set("page", String(page));

		if (orientation) {
			url.searchParams.set("orientation", orientation);
		}

		url.searchParams.set("size", "small");
		url.searchParams.set("per_page", "32");
		const response = await pexelsRequest({ ...request, url });

		const data = z
			.object({ photos: z.array(pexelsPhotoSchema), total_results: z.number() })
			.parse(await response.json());

		return { hasMore: page * 32 < data.total_results, items: data.photos.map(pexelsCandidate) };
	},
};

export const stockImageProviders: Array<StockImageProvider> = [unsplash, pexels];
