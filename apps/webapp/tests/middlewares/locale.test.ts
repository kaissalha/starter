/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";

import { describe, expect, it } from "vitest";

import { localeMiddleware } from "@/middlewares/locale";

const run = (path: string, cookie?: string) =>
	localeMiddleware(
		new NextRequest(`https://example.com${path}`, { headers: cookie ? { cookie: `NEXT_LOCALE=${cookie}` } : {} })
	);

describe("localeMiddleware", () => {
	it.each([
		["/dashboard/chat?x=1", "/ar/dashboard/chat?x=1"],
		["/login", "/ar/login"],
		["/accept-invitation/abc", "/ar/accept-invitation/abc"],
	])("redirects %s to the persisted locale", async (path, location) => {
		const response = await run(path, "ar");

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe(`https://example.com${location}`);
	});

	it.each([
		["/dashboard", "en"],
		["/dashboard", undefined],
		["/privacy", "ar"],
		["/dashboardx", "ar"],
		["/pricing", "ar"],
		["/dashboard", "zz"],
	])("rewrites %s with cookie %s to the default locale", async (path, cookie) => {
		const response = await run(path, cookie);

		expect(response.headers.get("location")).toBeNull();
		expect(response.headers.get("x-middleware-rewrite")).toBe(`https://example.com/en${path}`);
	});

	it("passes api routes through", async () => {
		const response = await run("/api/anything", "ar");

		expect(response.headers.get("location")).toBeNull();
		expect(response.headers.get("x-middleware-rewrite")).toBeNull();
	});
});
