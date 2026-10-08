import { afterEach, describe, expect, it, vi } from "vitest";

import { getMarkdownPageUrl, getMarkdownRewriteUrl } from "../src/markdown-request";
import { getMarkdownResponse } from "../src/markdown-response";

const html =
	'<!doctype html><html lang="en"><head><title>About us</title></head><body><nav>Navigation</nav><main><h1>Hello</h1><p>Read <a href="/about">about us</a>.</p></main><footer>Footer</footer></body></html>';

const pageResponse = (body = html, status = 200) =>
	new Response(body, { headers: { "Content-Type": "text/html" }, status });

const request = (path = "/about", headers?: HeadersInit) => {
	const url = new URL("https://site.example/api/accept-md");
	url.searchParams.set("path", path);

	return new Request(url, { headers });
};

afterEach(() => vi.unstubAllGlobals());

describe("Markdown request routing", () => {
	it.each(["text/markdown", "TEXT/MARKDOWN; charset=utf-8", "text/html;q=0.5, text/markdown;q=0.9"])(
		"accepts %s and preserves locale and query",
		(accept) => {
			const rewrite = getMarkdownRewriteUrl(
				new Request("https://site.example/ar/about?page=2&path=original", { headers: { accept } })
			);

			expect(rewrite?.pathname).toBe("/api/accept-md");
			expect(rewrite?.searchParams.get("path")).toBe("/ar/about?page=2&path=original");
		}
	);

	it.each([
		"",
		"text/html",
		"*/*",
		"text/markdown;q=0",
		"text/markdown;q=0.2,text/html",
		"text/markdown-extra",
		"text/markdown;q=oops",
	])("leaves %s on the normal page route", (accept) => {
		expect(getMarkdownRewriteUrl(new Request("https://site.example/", { headers: { accept } }))).toBeNull();
	});

	it.each(["POST", "PUT", "DELETE", "OPTIONS"])("leaves %s requests on their original route", (method) => {
		expect(
			getMarkdownRewriteUrl(
				new Request("https://site.example/", { headers: { accept: "text/markdown" }, method })
			)
		).toBeNull();
	});

	it.each(["rsc", "next-router-state-tree", "next-action"])("preserves the %s protocol", (header) => {
		expect(
			getMarkdownRewriteUrl(
				new Request("https://site.example/", { headers: { accept: "text/markdown", [header]: "1" } })
			)
		).toBeNull();
	});

	it.each([
		"/api",
		"/api/contact",
		"/_next/static/chunk.js",
		"/_vercel/insights",
		"/.well-known/workflow",
		"/robots.txt",
		"/sitemap.xml",
		"/favicon.ico",
		"/image.png",
	])("preserves the existing handler for %s", (path) => {
		expect(
			getMarkdownRewriteUrl(new Request(`https://site.example${path}`, { headers: { accept: "text/markdown" } }))
		).toBeNull();
	});

	it("preserves app-specific prefixes the caller excludes", () => {
		const request = (path: string) =>
			new Request(`https://site.example${path}`, { headers: { accept: "text/markdown" } });

		expect(getMarkdownRewriteUrl(request("/ingest/events"), { excludedPrefixes: ["ingest", "umbra"] })).toBeNull();
		expect(getMarkdownRewriteUrl(request("/umbra/stats"), { excludedPrefixes: ["ingest", "umbra"] })).toBeNull();
		expect(getMarkdownRewriteUrl(request("/ingest/events"))).not.toBeNull();
	});

	it.each([
		"//other.example/",
		"/\n/other.example/",
		String.raw`/\other.example/`,
		"https://other.example/",
		"/%2fother.example/",
		"/%5cother.example/",
		"/%61pi/internal",
		"/page/../api/internal",
		"/%2561pi/internal",
		"/%",
		"/api/accept-md?path=/",
	])("rejects unsafe or recursive page targets: %s", (path) => {
		expect(getMarkdownPageUrl({ baseUrl: "https://site.example", path })).toBeNull();
	});
});

describe("Markdown responses", () => {
	it("converts real HTML with metadata and links", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pageResponse()));
		const response = await getMarkdownResponse(request());
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
		expect(response.headers.get("Vary")).toBe("Accept");
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		const markdown = await response.text();
		expect(markdown).toContain('title: "About us"');
		expect(markdown).toContain("# Hello");
		expect(markdown).toContain("[about us](/about)");
		expect(markdown).not.toMatch(/Navigation|Footer|<main>/);
	});

	it("fetches each host and session separately while discarding transport and spoofed routing headers", async () => {
		const fetchPage = vi.fn<typeof fetch>().mockImplementation(async () => pageResponse());
		vi.stubGlobal("fetch", fetchPage);
		await getMarkdownResponse(
			request("/ar/about?page=2", {
				"accept-language": "ar",
				authorization: "Bearer first",
				cookie: "session=first",
				rsc: "1",
				"x-accept-md-path": "/api/internal",
				"x-forwarded-host": "other.example",
			})
		);
		await getMarkdownResponse(request("/ar/about?page=2", { cookie: "session=second" }));
		await getMarkdownResponse(new Request("https://another.example/api/accept-md?path=/ar/about"));
		expect(fetchPage).toHaveBeenCalledTimes(3);
		const [url, init] = fetchPage.mock.calls[0] ?? [];
		expect(String(url)).toBe("https://site.example/ar/about?page=2");
		expect(init).toMatchObject({ cache: "no-store", redirect: "manual" });
		expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
			accept: "text/html",
			"accept-language": "ar",
			authorization: "Bearer first",
			cookie: "session=first",
		});
		expect(new Headers(fetchPage.mock.calls[1]?.[1]?.headers).get("cookie")).toBe("session=second");
		expect(String(fetchPage.mock.calls[2]?.[0])).toBe("https://another.example/ar/about");
	});

	it("returns authentication redirects and refreshed cookies without following them", async () => {
		const fetchPage = vi.fn().mockResolvedValue(
			new Response(null, {
				headers: { Location: "/login?redirect_url=/dashboard", "Set-Cookie": "session=renewed; HttpOnly" },
				status: 307,
			})
		);

		vi.stubGlobal("fetch", fetchPage);
		const response = await getMarkdownResponse(request("/dashboard"));
		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toBe("https://site.example/login?redirect_url=/dashboard");
		expect(response.headers.getSetCookie()).toEqual(["session=renewed; HttpOnly"]);
		expect(fetchPage).toHaveBeenCalledOnce();
	});

	it.each([401, 403, 404, 500])("preserves upstream status %i", async (status) => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(pageResponse("<html><body><h1>Page unavailable</h1></body></html>", status))
		);
		const response = await getMarkdownResponse(request());
		expect(response.status).toBe(status);
		expect(await response.text()).toContain("# Page unavailable");
	});

	it("preserves non-HTML response bodies", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Unavailable" }, { status: 503 })));
		const response = await getMarkdownResponse(request());
		expect(response.status).toBe(503);
		expect(response.headers.get("Content-Type")).toBe("application/json");
		expect(await response.json()).toEqual({ error: "Unavailable" });
	});

	it("rejects direct requests for excluded paths before fetching", async () => {
		const fetchPage = vi.fn();
		vi.stubGlobal("fetch", fetchPage);
		const response = await getMarkdownResponse(request("/api/contact"));
		expect(response.status).toBe(404);
		expect(fetchPage).not.toHaveBeenCalled();
	});
});
