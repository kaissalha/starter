const reservedPrefixes = ["api", "_next", "_vercel", ".well-known"];

const isExcludedPath = ({
	excludedPrefixes,
	pathname,
}: {
	excludedPrefixes: ReadonlyArray<string>;
	pathname: string;
}) => {
	const prefix = pathname.split("/")[1]?.toLowerCase() ?? "";

	return reservedPrefixes.includes(prefix) || excludedPrefixes.includes(prefix);
};

export const getMarkdownPageUrl = ({
	baseUrl,
	excludedPrefixes = [],
	path,
}: {
	baseUrl: string;
	excludedPrefixes?: ReadonlyArray<string>;
	path: string;
}) => {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
		return null;
	}

	try {
		const url = new URL(path, baseUrl);
		const pathname = decodeURIComponent(url.pathname);

		if (
			url.origin !== new URL(baseUrl).origin ||
			pathname.startsWith("//") ||
			/[\\%]/.test(pathname) ||
			pathname.split("/").some((segment) => segment === "." || segment === "..") ||
			isExcludedPath({ excludedPrefixes, pathname }) ||
			/\.[^/]+$/.test(pathname)
		) {
			return null;
		}

		url.hash = "";

		return url;
	} catch {
		return null;
	}
};

const mediaQuality = (accept: string, mediaType: string) =>
	Math.max(
		0,
		...accept.split(",").map((entry) => {
			const [type, ...parameters] = entry.trim().toLowerCase().split(";");

			if (type?.trim() !== mediaType) {
				return 0;
			}

			const quality = Number(
				parameters.find((parameter) => parameter.trim().startsWith("q="))?.split("=")[1] ?? 1
			);

			return Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0;
		})
	);

export const getMarkdownRewriteUrl = (
	request: Request,
	{ excludedPrefixes = [] }: { excludedPrefixes?: ReadonlyArray<string> } = {}
) => {
	const accept = request.headers.get("accept") ?? "";
	const markdownQuality = mediaQuality(accept, "text/markdown");

	if (
		(request.method !== "GET" && request.method !== "HEAD") ||
		request.headers.has("rsc") ||
		request.headers.has("next-router-state-tree") ||
		request.headers.has("next-action") ||
		markdownQuality === 0 ||
		markdownQuality < mediaQuality(accept, "text/html")
	) {
		return null;
	}

	const original = new URL(request.url);
	const path = `${original.pathname}${original.search}`;

	if (!getMarkdownPageUrl({ baseUrl: original.origin, excludedPrefixes, path })) {
		return null;
	}

	const rewrite = new URL("/api/accept-md", original);
	rewrite.searchParams.set("path", path);

	return rewrite;
};
