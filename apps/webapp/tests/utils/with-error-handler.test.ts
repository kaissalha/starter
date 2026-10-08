import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	error: vi.fn(),
	set: vi.fn(),
}));

vi.mock("@/lib/evlog", () => ({
	useLogger: () => ({
		error: mocks.error,
		getContext: () => ({ requestId: "request-1" }),
		set: mocks.set,
	}),
}));

import { withErrorHandler } from "@/utils/with-error-handler";

const unexpectedErrorBody = { error: { message: "An unexpected error occurred.", requestId: "request-1" } };

describe("withErrorHandler", () => {
	beforeEach(() => {
		mocks.error.mockClear();
		mocks.set.mockClear();
	});

	it("attaches request context without query parameters", async () => {
		const handler = withErrorHandler(async () => Response.json({ ok: true }));

		const response = await handler(
			new Request("https://starter.example/api/v1/brands?token=secret", {
				method: "POST",
			})
		);

		expect(response.status).toBe(200);

		expect(mocks.set).toHaveBeenCalledWith({
			http: {
				method: "POST",
				path: "/api/v1/brands",
			},
		});
	});

	it("records unexpected errors on the request event", async () => {
		const failure = new Error("Unexpected failure");

		const handler = withErrorHandler(async () => {
			throw failure;
		});

		const response = await handler(new Request("https://starter.example/api/media"));

		expect(response.status).toBe(500);
		expect(mocks.error).toHaveBeenCalledWith(failure);

		await expect(response.json()).resolves.toEqual(unexpectedErrorBody);

		expect(response.headers.get("x-request-id")).toBe("request-1");
	});

	it("does not disclose internal oRPC error messages", async () => {
		const failure = new ORPCError("INTERNAL_SERVER_ERROR", { message: "Database connection details" });

		const response = await withErrorHandler(async () => {
			throw failure;
		})(new Request("https://starter.example/api/rpc"));

		expect(response.status).toBe(500);
		expect(mocks.error).toHaveBeenCalledWith(failure);

		await expect(response.json()).resolves.toEqual(unexpectedErrorBody);
	});

	it("maps rate-limited API keys to 429 without recording an error", async () => {
		const response = await withErrorHandler(async () => {
			throw new ORPCError("TOO_MANY_REQUESTS", { message: "API key rate limit exceeded." });
		})(new Request("https://starter.example/api/mcp"));

		expect(response.status).toBe(429);
		expect(mocks.error).not.toHaveBeenCalled();
		await expect(response.json()).resolves.toMatchObject({ error: { message: "API key rate limit exceeded." } });
	});

	it.each(["cross-site", "same-site"])("rejects %s cookie-authenticated mutations", async (fetchSite) => {
		const handler = vi.fn(async () => Response.json({ ok: true }));

		const response = await withErrorHandler(handler)(
			new Request("https://starter.example/api/rpc", {
				headers: { cookie: "a=b", "sec-fetch-site": fetchSite },
				method: "POST",
			})
		);

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			error: { message: "Cross-site requests are not allowed.", requestId: "request-1" },
		});
		expect(handler).not.toHaveBeenCalled();
		expect(mocks.error).not.toHaveBeenCalled();
	});

	it.each<{ headers: Record<string, string>; method: string }>([
		{ headers: { cookie: "a=b", "sec-fetch-site": "same-origin" }, method: "POST" },
		{ headers: { cookie: "a=b", "sec-fetch-site": "none" }, method: "POST" },
		{ headers: { cookie: "a=b" }, method: "POST" },
		{ headers: { "sec-fetch-site": "cross-site" }, method: "POST" },
		{ headers: { cookie: "a=b", "sec-fetch-site": "cross-site" }, method: "GET" },
	])("allows $method with $headers", async (init) => {
		const response = await withErrorHandler(async () => Response.json({ ok: true }))(
			new Request("https://starter.example/api/rpc", init)
		);

		expect(response.status).toBe(200);
	});
});
