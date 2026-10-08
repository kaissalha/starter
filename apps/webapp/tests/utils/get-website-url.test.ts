import { afterEach, describe, expect, it, vi } from "vitest";

import { getWebsiteUrl } from "@/utils/get-website-url";

afterEach(() => vi.unstubAllEnvs());

describe("website URLs", () => {
	it("uses the selected site's local host even when a deployment URL is configured", () => {
		vi.stubEnv("NODE_ENV", "development");
		expect(
			getWebsiteUrl({ publicUrl: "https://example.com", websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339" })
		).toBe("http://018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339.localhost:3001");
		expect(getWebsiteUrl({ publicUrl: "https://example.com" })).toBeUndefined();
	});
	it("keeps the deployed public URL outside development", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(getWebsiteUrl({ publicUrl: "https://example.com", websiteId: "local-site" })).toBe(
			"https://example.com"
		);
		expect(getWebsiteUrl({ websiteId: "local-site" })).toBeUndefined();
	});
});
