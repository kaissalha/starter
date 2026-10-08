/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/accept-md/route";

afterEach(() => vi.unstubAllGlobals());

describe("accept-md Route", () => {
	it("serves HTML as Markdown through the route wrappers", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response("<html><body><h1>Hello</h1></body></html>", {
					headers: { "Content-Type": "text/html" },
				})
			)
		);
		const response = await GET(new Request("http://localhost:3000/api/accept-md?path=/about"));
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(await response.text()).toContain("# Hello");
	});

	it("sanitizes unexpected fetch errors", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Private internal details")));
		const response = await GET(new Request("http://localhost:3000/api/accept-md?path=/about"));
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: { message: "An unexpected error occurred.", requestId: expect.any(String) },
		});
	});
});
