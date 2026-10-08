/**
 * @vitest-environment node
 */
import { NextRequest, NextResponse } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/middlewares/locale", () => ({
	localeMiddleware: vi.fn(),
}));

vi.mock("@/middlewares/protected", () => ({
	protectedMiddleware: vi.fn(),
}));

vi.mock("@/middlewares/public", () => ({
	publicMiddleware: vi.fn(),
}));

import { localeMiddleware } from "@/middlewares/locale";
import { protectedMiddleware } from "@/middlewares/protected";
import { publicMiddleware } from "@/middlewares/public";
import proxy from "@/proxy";

const createRequest = (url: string, headers?: HeadersInit) => new NextRequest(url, { headers });

const createEvent = (): Parameters<typeof proxy>[1] => ({
	passThroughOnException: vi.fn(),
	waitUntil: vi.fn(),
});

describe("proxy middleware", () => {
	const mockLocaleMiddleware = vi.mocked(localeMiddleware);
	const mockProtectedMiddleware = vi.mocked(protectedMiddleware);
	const mockPublicMiddleware = vi.mocked(publicMiddleware);

	const asResponse = (value: Awaited<ReturnType<typeof proxy>>) => {
		expect(value).toBeInstanceOf(Response);

		if (!(value instanceof Response)) {
			throw new Error("Expected proxy to return a response");
		}

		return value;
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockProtectedMiddleware.mockResolvedValue(undefined);
		mockPublicMiddleware.mockResolvedValue(undefined);
		mockLocaleMiddleware.mockResolvedValue(NextResponse.next());
	});

	it("keeps normal page requests on the existing middleware flow", async () => {
		const localeResponse = NextResponse.next();
		localeResponse.headers.set("x-test-middleware", "locale");
		mockLocaleMiddleware.mockResolvedValue(localeResponse);

		const response = await proxy(createRequest("https://example.com/pricing"), createEvent());

		expect(response).toBe(localeResponse);
		expect(mockLocaleMiddleware).toHaveBeenCalledTimes(1);
		const responseWithHeaders = asResponse(response);
		expect(responseWithHeaders.headers.get("x-middleware-rewrite")).toBeNull();
		expect(responseWithHeaders.headers.get("Vary")).toContain("Accept");
	});

	it("rewrites markdown requests for normal pages to accept-md handler", async () => {
		const response = await proxy(
			createRequest("https://example.com/about?utm_source=test", {
				accept: "text/markdown",
			}),
			createEvent()
		);

		const responseWithHeaders = asResponse(response);

		const rewriteHeader = responseWithHeaders.headers.get("x-middleware-rewrite");
		expect(rewriteHeader).toContain("/api/accept-md");
		expect(rewriteHeader).toContain("path=%2Fabout%3Futm_source%3Dtest");
		expect(mockProtectedMiddleware).not.toHaveBeenCalled();
		expect(mockPublicMiddleware).not.toHaveBeenCalled();
		expect(mockLocaleMiddleware).not.toHaveBeenCalled();
	});

	it("does not rewrite excluded paths even when markdown is requested", async () => {
		const localeResponse = NextResponse.next();
		mockLocaleMiddleware.mockResolvedValue(localeResponse);

		const response = await proxy(
			createRequest("https://example.com/api/ai/chat", {
				accept: "text/markdown",
			}),
			createEvent()
		);

		expect(asResponse(response).headers.get("x-middleware-rewrite")).toBeNull();
		expect(mockLocaleMiddleware).toHaveBeenCalledTimes(1);
		expect(mockProtectedMiddleware).not.toHaveBeenCalled();
	});
});
