import { describe, expect, it } from "vitest";

import { getHostnameFromUrl, resolveUrl } from "../src/url";

describe("getHostnameFromUrl", () => {
	it("strips www and returns hostname", () => {
		expect(getHostnameFromUrl({ url: "https://www.example.com/path" })).toBe("example.com");
	});

	it("returns the original value when parsing fails", () => {
		expect(getHostnameFromUrl({ url: "not-a-url" })).toBe("not-a-url");
	});
});

describe("resolveUrl", () => {
	it("resolves protocol-relative, root-relative, and relative URLs", () => {
		const base = "https://example.com/page";

		expect(resolveUrl({ base, href: "//cdn.example.com/icon.png" })).toBe("https://cdn.example.com/icon.png");
		expect(resolveUrl({ base, href: "/favicon.ico" })).toBe("https://example.com/favicon.ico");
		expect(resolveUrl({ base, href: "assets/icon.png" })).toBe("https://example.com/assets/icon.png");
	});
});
