import { describe, expect, it } from "vitest";

import { getLoginRedirect } from "@/utils/get-login-redirect";

describe("getLoginRedirect", () => {
	it.each([
		"/accept-invitation/invite-1",
		"/ar/accept-invitation/invite-1?from=email#details",
		"/dashboard/chat?filter=recent",
	])("preserves the local return URL %s", (path) => {
		expect(getLoginRedirect(path)).toBe(path);
	});

	it.each([
		null,
		"",
		"https://evil.example",
		"//evil.example",
		String.raw`/\evil.example`,
		"/%2f%2fevil.example",
		"/%5cevil.example",
		"/.//evil.example",
		"/%2e%2e//evil.example",
		"/\n/evil.example",
		"javascript:alert(1)",
		"/%invalid",
		"/login",
		"/ar/login?redirect_url=/login",
		"/signup",
	])("rejects unsafe or looping return URL %s", (path) => {
		expect(getLoginRedirect(path)).toBeNull();
	});
});
