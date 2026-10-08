import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/evlog", () => ({
	logProcedureErrors: async ({ next }: { next: () => Promise<Record<string, never>> }) => next(),
	useLogger: () => ({ set: vi.fn() }),
	withEvlog: <Handler>(handler: Handler) => handler,
}));

vi.mock("@/utils/with-error-handler", () => ({
	withErrorHandler: <Handler>(handler: Handler) => handler,
}));

vi.mock("@starter/server/api", async () => {
	const { openapi } = await import("@orpc/openapi");
	const { os } = await import("@orpc/server");

	const probe = os
		.$context<{ authMode?: "session-only" | "session-or-api-key" }>()
		.meta(openapi({ method: "GET", path: "/probe" }))
		.handler(({ context }) => ({ authMode: context.authMode }));

	return {
		apiRouter: { probe },
		generateOpenApiSpec: vi.fn(async () => ({})),
		isPublicApiProcedure: () => true,
		openApiSpecPath: "/openapi.json",
	};
});

import { GET as rpcGet, POST as rpcPost } from "@/app/api/rpc/[[...rest]]/route";
import { GET as publicGet } from "@/app/api/v1/[[...rest]]/route";

describe("oRPC route adapters", () => {
	it("marks the in-app RPC surface as session-only", async () => {
		const response = await rpcPost(
			new Request("https://example.com/api/rpc/probe", {
				body: JSON.stringify({ json: {} }),
				headers: { "content-type": "application/json" },
				method: "POST",
			})
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ json: { authMode: "session-only" } });
	});

	it("marks the filtered public surface as API-key capable", async () => {
		const response = await publicGet(new Request("https://example.com/api/v1/probe"));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ authMode: "session-or-api-key" });
	});

	it("returns a stable 404 response for unknown RPC procedures", async () => {
		const response = await rpcGet(new Request("https://example.com/api/rpc/unknown"));

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: { message: "Not found." } });
	});

	it("rejects oversized RPC request bodies before procedure decoding", async () => {
		const response = await rpcPost(
			new Request("https://example.com/api/rpc/probe", {
				body: "x".repeat(4_000_001),
				headers: { "content-type": "application/json" },
				method: "POST",
			})
		);

		expect(response.status).toBe(413);
	});
});
