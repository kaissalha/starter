import { getHostnameFromUrl, resolveUrl } from "@starter/utils";

import { checkRateLimit } from "../lib/redis";

export class LinkPreviewRateLimitError extends Error {}

const extractUrlMetadata = ({ html, originalUrl }: { html: string; originalUrl: string }) => {
	const tags = Array.from(html.matchAll(/<(link|meta)\s[^>]{1,1024}>/giu), ([tag, name = ""]) => ({
		attributes: new Map(
			Array.from(
				tag.matchAll(/([\w:-]{1,32})\s{0,8}=\s{0,8}(?:"([^"]*)"|'([^']*)')/gu),
				([, key = "", double, single]) => [key.toLowerCase(), (double ?? single ?? "").trim()]
			)
		),
		name: name.toLowerCase(),
	}));

	const readMeta = (key: "name" | "property", value: string) =>
		tags
			.find(
				({ attributes, name }) =>
					name === "meta" && attributes.get(key)?.toLowerCase() === value && attributes.get("content")
			)
			?.attributes.get("content") ?? "";

	const favicon = [
		...tags.flatMap(({ attributes, name }) =>
			name === "link" && attributes.get("rel")?.toLowerCase().split(/\s+/u).includes("icon")
				? [attributes.get("href") ?? ""]
				: []
		),
		readMeta("property", "og:image"),
	]
		.flatMap((href) => (href ? [URL.parse(resolveUrl({ base: originalUrl, href }))] : []))
		.find((url) => url?.protocol === "http:" || url?.protocol === "https:");

	return {
		description: (readMeta("property", "og:description") || readMeta("name", "description")).slice(0, 150),
		favicon: favicon?.href ?? new URL("/favicon.ico", originalUrl).href,
		siteName: (readMeta("property", "og:site_name") || getHostnameFromUrl({ url: originalUrl })).slice(0, 100),
		title: (
			readMeta("property", "og:title") ||
			html.match(/<title[^>]{0,256}>([^<]+)<\/title>/iu)?.[1]?.trim() ||
			"Untitled"
		).slice(0, 200),
		url: originalUrl,
	};
};

export const getLinkPreview = async ({ url, userId }: { url: string; userId: string }) => {
	const { allowed } = await checkRateLimit({ key: `link-preview:${userId}`, max: 30, windowSeconds: 60 });

	if (!allowed) {
		throw new LinkPreviewRateLimitError("Too many link previews.");
	}

	try {
		const response = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0)" },
			signal: AbortSignal.timeout(10_000),
		});

		return response.ok
			? extractUrlMetadata({ html: (await response.text()).slice(0, 262_144), originalUrl: url })
			: null;
	} catch {
		return null;
	}
};
