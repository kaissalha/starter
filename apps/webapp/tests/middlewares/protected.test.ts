/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";

import { expect, it } from "vitest";

import { protectedMiddleware } from "@/middlewares/protected";

const run = (url: string, cookie?: string) =>
	protectedMiddleware(new NextRequest(url, { headers: cookie ? { cookie } : {} }));

it.each([
	["https://example.com/en/dashboard/chat", "https://example.com/en/login?redirect_url=%2Fen%2Fdashboard%2Fchat"],
	["https://example.com/dashboard", "https://example.com/login?redirect_url=%2Fdashboard"],
])("redirects %s without a session cookie to login", async (url, location) => {
	expect((await run(url))?.headers.get("location")).toBe(location);
});

it.each([
	["https://example.com/en/dashboard", "better-auth.session_token=token"],
	["https://example.com/en/dashboard", "__Secure-better-auth.session_token=token"],
	["https://example.com/en/onboarding", "better-auth.session_token=token"],
])("lets %s through with a session cookie", async (url, cookie) => {
	expect(await run(url, cookie)).toBeUndefined();
});
