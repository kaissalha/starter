import type { ResolvedAsset, WebsiteAssetBindings } from "@starter/infinite-website/contracts";
import { WebsiteEditError, type WebsiteEditInput } from "@starter/infinite-website/editing";
import { sectionAuthoringResourceLimits } from "@starter/infinite-website/editing";
import { generationSeedHash } from "@starter/infinite-website/generation";

import { bindStockImageCandidate, searchStockImages, type StockImageCandidate } from "../../lib/stock-images";
import { getUploadedMedia } from "../media";
import { chooseStockImageCandidate } from "../stock-image-choice";

const MAX_AUTHORING_MEDIA = sectionAuthoringResourceLimits.media;

const MAX_SITE_STOCK_ASSETS = 32;

const MAX_CONCURRENT_STOCK_QUERIES = 8;

const STOCK_RESOLUTION_DEADLINE_MS = 12_000;

export const WEBSITE_PLACEHOLDER_ASSET = {
	decoding: "async",
	height: 1000,
	loading: "lazy",
	src: "/website-image-placeholder.svg",
	type: "image",
	width: 1600,
} as const;

export const selectReusableWebsiteImages = ({ assets }: { assets: Array<ResolvedAsset> }) => [
	...new Map(
		assets.flatMap((asset) =>
			asset.type !== "video" &&
			asset.src !== WEBSITE_PLACEHOLDER_ASSET.src &&
			!asset.src.startsWith("data:image/svg+xml")
				? [[asset.src, asset] as const]
				: []
		)
	).values(),
];

export type WebsiteAssetIntent = {
	assetId: string;
	profileKeyword: string;
	searchable: boolean;
	sectionCategory: string;
	sectionPurpose: string;
	slotKey: string;
	stockIndex: number;
	stockRole: "hero-background" | "section-illustration" | null;
};

export const createWebsiteBrandMarkAsset = ({
	brandColors,
	businessName,
}: {
	brandColors: { background: string; primary: string };
	businessName: string;
}) => {
	const name = businessName.trim() || "Business";

	const escapedName = name
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");

	const inlinePadding = 16;
	const width = Math.max(80, name.length * 28) + inlinePadding * 2;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 120"><text x="${inlinePadding}" y="61" fill="${brandColors.primary}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="52" font-weight="700" letter-spacing="-2" dominant-baseline="middle">${escapedName}</text></svg>`;

	return {
		decoding: "async" as const,
		height: 120,
		loading: "eager" as const,
		src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
		type: "image" as const,
		width,
	};
};

type WebsiteStockIntent = Pick<WebsiteAssetIntent, "assetId" | "stockIndex"> & {
	loading: "eager" | "lazy";
};

type WebsiteStockQueryGroup = {
	intents: Array<WebsiteStockIntent>;
	purpose?: string;
	query: string;
};

const websiteStockScenes = ["people at work", "hands at work", "customer conversation", "workspace"];

const createWebsiteStockQuery = ({
	businessName,
	businessType,
	intent,
}: {
	businessName: string;
	businessType: string;
	intent: WebsiteAssetIntent;
}) =>
	`${businessType} ${websiteStockScenes[(generationSeedHash(businessName) + intent.stockIndex) % websiteStockScenes.length]} ${intent.stockRole === "hero-background" ? "wide" : "detail"}`;

const createWebsiteStockGroups = (
	entries: Array<{ intent: WebsiteStockIntent; purpose?: string; query: string }>
): Map<string, WebsiteStockQueryGroup> => {
	const groups = new Map<string, WebsiteStockQueryGroup>();

	for (const { intent, purpose, query: rawQuery } of entries) {
		const query = rawQuery.replaceAll(/\s+/gu, " ").trim();
		const normalizedQuery = query.normalize("NFKC").toLocaleLowerCase("en-US");
		const group = groups.get(normalizedQuery);

		if (group) {
			group.intents.push(intent);
		} else {
			groups.set(normalizedQuery, { intents: [intent], purpose, query });
		}
	}

	return groups;
};

const chooseWebsiteStockCandidate = async ({
	candidates,
	group,
	signal,
}: {
	candidates: Array<StockImageCandidate>;
	group: WebsiteStockQueryGroup;
	signal: AbortSignal;
}) => {
	if (!group.purpose || candidates.length === 0) {
		return null;
	}

	try {
		return await chooseStockImageCandidate({
			abortSignal: signal,
			candidates,
			functionId: "website-stock-image-selection",
			policy: "background",
			purpose: group.purpose,
			query: group.query,
		});
	} catch {
		return null;
	}
};

const selectDistinctCandidate = ({
	candidates,
	selectedUrls,
	stockIndex,
}: {
	candidates: Array<StockImageCandidate>;
	selectedUrls: Set<string>;
	stockIndex: number;
}) => {
	const startIndex = ((stockIndex % candidates.length) + candidates.length) % candidates.length;

	const candidate = [...candidates.slice(startIndex), ...candidates.slice(0, startIndex)].find(
		({ hotlinkUrl }) => !selectedUrls.has(hotlinkUrl)
	);

	if (candidate) {
		selectedUrls.add(candidate.hotlinkUrl);
	}

	return candidate ?? null;
};

const searchStockImagesSafely = async ({ query, signal }: { query: string; signal: AbortSignal }) => {
	try {
		return (await searchStockImages({ orientation: "landscape", query, signal })).items;
	} catch {
		return [];
	}
};

const resolveWebsiteStockGroup = async ({
	group,
	selectedUrls,
	signal,
}: {
	group: WebsiteStockQueryGroup;
	selectedUrls: Set<string>;
	signal: AbortSignal;
}) => {
	const candidates = await searchStockImagesSafely({ query: group.query, signal });
	const chosen = await chooseWebsiteStockCandidate({ candidates, group, signal });

	const selected: Array<{ assetId: string; candidate: StockImageCandidate; loading: "eager" | "lazy" }> = [];

	for (const [index, intent] of group.intents.entries()) {
		const preferred = index === 0 && chosen && !selectedUrls.has(chosen.hotlinkUrl) ? chosen : null;

		if (preferred) {
			selectedUrls.add(preferred.hotlinkUrl);
		}

		const candidate =
			preferred ??
			selectDistinctCandidate({
				candidates,
				selectedUrls,
				stockIndex: intent.stockIndex,
			});

		if (!candidate) {
			continue;
		}

		selected.push({ assetId: intent.assetId, candidate, loading: intent.loading });
	}

	const resolved = await Promise.all(
		selected.map(async ({ assetId, candidate, loading }) => {
			try {
				return {
					assetId,
					binding: await bindStockImageCandidate({ candidate, loading, signal }),
				};
			} catch {
				return null;
			}
		})
	);

	return resolved.filter((asset) => asset !== null);
};

const resolveWebsiteStockGroups = async (groups: Map<string, WebsiteStockQueryGroup>, abortSignal?: AbortSignal) => {
	abortSignal?.throwIfAborted();
	const stockGroups = groups.values();
	const selectedUrls = new Set<string>();
	const deadline = AbortSignal.timeout(STOCK_RESOLUTION_DEADLINE_MS);
	const signal = abortSignal ? AbortSignal.any([abortSignal, deadline]) : deadline;

	const resolveStockGroups = async () => {
		const resolved: Awaited<ReturnType<typeof resolveWebsiteStockGroup>> = [];

		for (const group of stockGroups) {
			abortSignal?.throwIfAborted();
			resolved.push(...(await resolveWebsiteStockGroup({ group, selectedUrls, signal })));
			abortSignal?.throwIfAborted();
		}

		return resolved;
	};

	const workers = Array.from({ length: Math.min(MAX_CONCURRENT_STOCK_QUERIES, groups.size) }, resolveStockGroups);

	return (await Promise.all(workers)).flat();
};

export const resolveWebsiteAuthoringMedia = async (media: Readonly<Record<string, { query: string }>>) => {
	const entries = Object.entries(media);

	if (entries.length > MAX_AUTHORING_MEDIA) {
		throw new Error(`Website authoring accepts at most ${MAX_AUTHORING_MEDIA} media intents`);
	}

	const resolved = entries.map(([asset, { query }], stockIndex) => ({
		asset,
		assetId: crypto.randomUUID(),
		query,
		stockIndex,
	}));

	const assets = Object.fromEntries(resolved.map(({ asset, assetId }) => [asset, assetId]));

	const bindings: WebsiteAssetBindings = Object.fromEntries(
		resolved.map(({ assetId }) => [assetId, WEBSITE_PLACEHOLDER_ASSET])
	);

	for (const result of await resolveWebsiteStockGroups(
		createWebsiteStockGroups(
			resolved.map(({ assetId, query, stockIndex }) => ({
				intent: { assetId, loading: "lazy", stockIndex },
				query,
			}))
		)
	)) {
		bindings[result.assetId] = result.binding;
	}

	return { assets, bindings };
};

export const resolveWebsiteAssets = async ({
	abortSignal,
	brandColors,
	businessName,
	businessType,
	fallbackAssets = [],
	intents,
}: {
	abortSignal?: AbortSignal;
	brandColors: { background: string; primary: string };
	businessName: string;
	businessType: string;
	fallbackAssets?: Array<ResolvedAsset>;
	intents: Array<WebsiteAssetIntent>;
}) => {
	const brandMark = createWebsiteBrandMarkAsset({ brandColors, businessName });
	const bindings: WebsiteAssetBindings = {};
	const stockIntents: Array<WebsiteAssetIntent> = [];
	const seenAssetIds = new Set<string>();

	for (const intent of intents) {
		if (seenAssetIds.has(intent.assetId)) {
			continue;
		}

		seenAssetIds.add(intent.assetId);

		bindings[intent.assetId] =
			intent.stockRole === null
				? brandMark
				: {
						...WEBSITE_PLACEHOLDER_ASSET,
						loading: intent.stockRole === "hero-background" ? "eager" : "lazy",
					};

		if (intent.stockRole !== null && intent.searchable && stockIntents.length < MAX_SITE_STOCK_ASSETS) {
			stockIntents.push(intent);
		}
	}

	const groups = createWebsiteStockGroups(
		stockIntents.map((intent) => ({
			intent: {
				assetId: intent.assetId,
				loading: intent.stockRole === "hero-background" ? "eager" : "lazy",
				stockIndex: intent.stockIndex,
			},
			purpose: `${businessType}: ${intent.sectionPurpose}`,
			query: createWebsiteStockQuery({ businessName, businessType, intent }),
		}))
	);

	const resolvedStockAssets = await resolveWebsiteStockGroups(groups, abortSignal);

	for (const resolved of resolvedStockAssets) {
		bindings[resolved.assetId] = resolved.binding;
	}

	const fallbackImages = selectReusableWebsiteImages({ assets: fallbackAssets });

	if (fallbackImages.length > 0) {
		for (const intent of intents) {
			const binding = bindings[intent.assetId];

			if (intent.stockRole === null || !intent.searchable || binding?.src !== WEBSITE_PLACEHOLDER_ASSET.src) {
				continue;
			}

			const fallback = fallbackImages[intent.stockIndex % fallbackImages.length];

			if (fallback) {
				bindings[intent.assetId] = {
					...fallback,
					loading: intent.stockRole === "hero-background" ? "eager" : "lazy",
				};
			}
		}
	}

	return bindings;
};

export const resolveWebsiteUploadedMedia = async ({
	inputs,
	organizationId,
}: {
	inputs: Array<WebsiteEditInput>;
	organizationId: string;
}) => {
	try {
		const uploads = await Promise.all(
			inputs.flatMap((input) =>
				input.operation === "update-media" ? [getUploadedMedia({ fileId: input.fileId, organizationId })] : []
			)
		);

		return Object.fromEntries(uploads.map((upload) => [upload.id, { src: upload.url, type: upload.kind }]));
	} catch {
		throw new WebsiteEditError("Uploaded media not found");
	}
};
