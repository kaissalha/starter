import { htmlToMarkdown, type MarkdownOptions } from "accept-md-runtime";
import { get as getHttp, type IncomingMessage } from "node:http";
import { get as getHttps } from "node:https";
import { arrayBuffer } from "node:stream/consumers";

import { getMarkdownPageUrl } from "./markdown-request";

const fetchMarkdownPage = async ({ headers, url }: { headers: Headers; url: URL }) => {
	const get = url.protocol === "https:" ? getHttps : getHttp;

	const response = await new Promise<IncomingMessage>((resolve, reject) => {
		get(url, { headers: Object.fromEntries(headers), signal: AbortSignal.timeout(30_000) }, resolve).on(
			"error",
			reject
		);
	});

	const responseHeaders = Object.entries(response.headers).flatMap<[string, string]>(([name, value]) =>
		value === undefined ? [] : (Array.isArray(value) ? value : [value]).map((item) => [name, item])
	);

	const body = await arrayBuffer(response);

	return new Response(body.byteLength ? body : null, { headers: responseHeaders, status: response.statusCode });
};

export const getMarkdownResponse = async (
	request: Request,
	options?: MarkdownOptions,
	upstreamTarget?: { hostname: string; origin: string }
) => {
	const url = new URL(request.url);

	const path =
		url.pathname === "/api/accept-md" ? (url.searchParams.get("path") ?? "/") : `${url.pathname}${url.search}`;

	const pageUrl = getMarkdownPageUrl({ baseUrl: upstreamTarget?.origin ?? url.origin, path });
	const headers = new Headers({ "Cache-Control": "private, no-store", Vary: "Accept" });

	if (!pageUrl) {
		return Response.json({ error: "Not found" }, { headers, status: 404 });
	}

	const fetchHeaders = new Headers({ Accept: "text/html" });

	if (upstreamTarget) {
		fetchHeaders.set("Host", upstreamTarget.hostname);
	}

	for (const name of ["cookie", "authorization", "accept-language"]) {
		const value = request.headers.get(name);

		if (value) {
			fetchHeaders.set(name, value);
		}
	}

	const upstream = upstreamTarget
		? await fetchMarkdownPage({ headers: fetchHeaders, url: pageUrl })
		: await fetch(pageUrl, {
				cache: "no-store",
				headers: fetchHeaders,
				redirect: "manual",
				signal: AbortSignal.timeout(30_000),
			});

	for (const cookie of upstream.headers.getSetCookie()) {
		headers.append("Set-Cookie", cookie);
	}

	const location = upstream.headers.get("location");

	if (location) {
		headers.set("Location", new URL(location, pageUrl).href);
	}

	const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

	if (!contentType.toLowerCase().startsWith("text/html") || (upstream.status >= 300 && upstream.status < 400)) {
		headers.set("Content-Type", contentType);

		return new Response(upstream.body, { headers, status: upstream.status });
	}

	const markdown = htmlToMarkdown(await upstream.text(), options);
	headers.set("Content-Type", "text/markdown; charset=utf-8");

	return new Response(markdown, { headers, status: upstream.status });
};
