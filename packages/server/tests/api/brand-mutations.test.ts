import { ORPCError } from "@orpc/client";
import { RPCHandler } from "@orpc/server/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	class WebsiteDraftNotFoundError extends Error {}

	class WebsiteMutationConflictError extends Error {}

	return {
		publishBrand: vi.fn(),
		resolveSession: vi.fn(),
		updateBrand: vi.fn(),
		WebsiteDraftNotFoundError,
		WebsiteMutationConflictError,
	};
});

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: vi.fn(async () => "owner"),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers({ "x-api-key": "starter_test" })),
}));

vi.mock("../../src/lib/auth", () => ({
	resolveSession: mocks.resolveSession,
}));

vi.mock("../../src/services/brands", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/brands")>()),
	publishBrand: mocks.publishBrand,
	updateBrand: mocks.updateBrand,
}));

vi.mock("../../src/services/websites/service", () => ({
	editWebsite: vi.fn(),
	getWebsite: vi.fn(),
	publishWebsite: vi.fn(),
	WebsiteDraftNotFoundError: mocks.WebsiteDraftNotFoundError,
	WebsiteMutationConflictError: mocks.WebsiteMutationConflictError,
}));

import { brands } from "../../src/api/routers/brands";

const handler = new RPCHandler({ brands });

const session = {
	session: { activeOrganizationId: "organization-1" },
	user: { email: "user@example.com", id: "user-1", name: "User" },
};

type CallOptions = { authMode?: "session-only" | "session-or-api-key"; body?: object; path: string };

const call = async ({ authMode = "session-only", body = {}, path }: CallOptions) => {
	const { response } = await handler.handle(
		new Request(`https://example.com/api/rpc/brands/${path}`, {
			body: JSON.stringify({ json: body }),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		{ context: { authMode }, prefix: "/api/rpc" }
	);

	return response;
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.resolveSession.mockResolvedValue(session);
});

describe("Brand mutation error mapping", () => {
	it.each([
		["update", { revision: "revision-1", update: { colors: { primary: "#123456" } } }, mocks.updateBrand],
		["publish", { revision: "revision-1" }, mocks.publishBrand],
	])("maps missing and stale Brand %s calls to NOT_FOUND and CONFLICT", async (path, body, mutation) => {
		mutation.mockRejectedValueOnce(new mocks.WebsiteDraftNotFoundError());
		expect((await call({ body, path }))?.status).toBe(404);

		mutation.mockRejectedValueOnce(new mocks.WebsiteMutationConflictError());
		expect((await call({ body, path }))?.status).toBe(409);
	});
});

describe("oRPC authentication boundary", () => {
	it("enables API keys only on explicitly public surfaces", async () => {
		mocks.resolveSession.mockImplementation(async (_headers, allowApiKey) => (allowApiKey ? session : null));

		expect((await call({ path: "listOptions" }))?.status).toBe(401);
		expect((await call({ authMode: "session-or-api-key", path: "listOptions" }))?.status).toBe(200);
		expect(mocks.resolveSession).toHaveBeenNthCalledWith(1, expect.any(Headers), false);
		expect(mocks.resolveSession).toHaveBeenNthCalledWith(2, expect.any(Headers), true);
	});

	it("maps API-key throttling to TOO_MANY_REQUESTS", async () => {
		mocks.resolveSession.mockRejectedValue(new ORPCError("TOO_MANY_REQUESTS"));

		expect((await call({ authMode: "session-or-api-key", path: "listOptions" }))?.status).toBe(429);
	});
});
