import { RPCHandler } from "@orpc/server/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { linkPreviews } from "../../src/api/routers/link-previews";

const mocks = vi.hoisted(() => ({
	getLinkPreview: vi.fn(),
	LinkPreviewRateLimitError: class extends Error {},
	resolveSession: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("../../src/lib/auth", () => ({
	resolveSession: mocks.resolveSession,
}));

vi.mock("../../src/services/link-preview", () => ({
	getLinkPreview: mocks.getLinkPreview,
	LinkPreviewRateLimitError: mocks.LinkPreviewRateLimitError,
}));

const url = "https://example.com/article";

const previewLink = async () =>
	(
		await new RPCHandler({ linkPreviews }).handle(
			new Request("https://example.com/api/rpc/linkPreviews/get", {
				body: JSON.stringify({ json: { url } }),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
			{ prefix: "/api/rpc" }
		)
	).response;

beforeEach(() => {
	vi.resetAllMocks();
	mocks.resolveSession.mockResolvedValue({ session: { activeOrganizationId: "org-1" }, user: { id: "user-1" } });
	mocks.getLinkPreview.mockResolvedValue({
		description: "Description",
		favicon: null,
		siteName: "example.com",
		title: "Article",
		url,
	});
});

describe("linkPreviews.get", () => {
	it("requires a signed-in user", async () => {
		mocks.resolveSession.mockResolvedValue(null);

		expect((await previewLink())?.status).toBe(401);
		expect(mocks.getLinkPreview).not.toHaveBeenCalled();
	});

	it("scopes the preview budget to the signed-in user", async () => {
		expect((await previewLink())?.status).toBe(200);
		expect(mocks.getLinkPreview).toHaveBeenCalledWith({ url, userId: "user-1" });
	});

	it("maps an exhausted budget to TOO_MANY_REQUESTS", async () => {
		mocks.getLinkPreview.mockRejectedValue(new mocks.LinkPreviewRateLimitError());

		expect((await previewLink())?.status).toBe(429);
	});
});
