import { beforeEach, describe, expect, it, vi } from "vitest";

import { followAuthRedirect } from "@/utils/follow-auth-redirect";

describe("followAuthRedirect", () => {
	const assign = vi.fn();

	beforeEach(() => {
		assign.mockClear();
		vi.stubGlobal("window", { location: { assign } });
	});

	it("navigates to the OAuth continuation URL after an in-flow sign-in", () => {
		const url = "https://example.com/api/auth/oauth2/authorize?client_id=client_1";

		expect(followAuthRedirect({ redirect: true, url })).toBe(true);
		expect(assign).toHaveBeenCalledWith(url);
	});

	it.each([
		["a plain sign-in response", { token: "session-token" }],
		["a redirect without a URL", { redirect: true }],
		["a URL without the redirect flag", { url: "https://example.com" }],
		["no data", undefined],
	])("stays put for %s", (_label, data) => {
		expect(followAuthRedirect(data)).toBe(false);
		expect(assign).not.toHaveBeenCalled();
	});
});
