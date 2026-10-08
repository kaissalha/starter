import { describe, expect, it, vi } from "vitest";

import { findSearchConsoleProperty } from "../../src/services/seo/search-console";

vi.mock("../../src/lib/auth", () => ({ auth: {} }));

describe("findSearchConsoleProperty", () => {
	it("matches a verified domain property for the website host", () => {
		expect(
			findSearchConsoleProperty(
				[
					{ permissionLevel: "siteUnverifiedUser", siteUrl: "sc-domain:example.com" },
					{ permissionLevel: "siteOwner", siteUrl: "sc-domain:example.com" },
				],
				"shop.example.com"
			)
		).toBe("sc-domain:example.com");
	});

	it("does not match a sibling domain or unrelated URL prefix", () => {
		expect(
			findSearchConsoleProperty(
				[
					{ permissionLevel: "siteOwner", siteUrl: "sc-domain:notexample.com" },
					{ permissionLevel: "siteOwner", siteUrl: "https://other.example.com/" },
				],
				"example.com"
			)
		).toBeUndefined();
	});
});
