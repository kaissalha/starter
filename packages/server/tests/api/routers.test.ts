import { ORPCError } from "@orpc/client";
import { RPCHandler } from "@orpc/server/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { WebsiteEditError } from "@starter/infinite-website/editing";

import { domains } from "../../src/api/routers/domains";
import { linkPreviews } from "../../src/api/routers/link-previews";
import { websites } from "../../src/api/routers/websites";
import {
	DomainPriceChangedError,
	DomainPurchaseDisabledError,
	DomainRegistrantError,
} from "../../src/services/websites/domain-registrations";
import { DomainSearchRateLimitError } from "../../src/services/websites/domain-search";
import { DomainConflictError, DomainNotFoundError } from "../../src/services/websites/domains";
import { WebsiteTextTranslationError } from "../../src/services/websites/edit-preparation";
import { WebsiteDraftNotFoundError, WebsiteMutationConflictError } from "../../src/services/websites/service";
import { hasOrganizationPermission, type OrganizationPermission } from "../../src/utils/permissions";

const mocks = vi.hoisted(() => ({
	cancelWebsiteWorkflow: vi.fn(),
	editWebsite: vi.fn(),
	getLinkPreview: vi.fn(),
	getWebsite: vi.fn(),
	getWebsiteRecord: vi.fn(),
	LinkPreviewRateLimitError: class extends Error {},
	publishWebsite: vi.fn(),
	quoteDomain: vi.fn(),
	requirePermission: vi.fn(),
	resolveSession: vi.fn(),
	role: "owner",
	streamWebsiteWorkflow: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("../../src/lib/auth", () => ({
	resolveSession: mocks.resolveSession,
}));

vi.mock("../../src/services/permissions", () => ({ requireOrganizationPermission: mocks.requirePermission }));

vi.mock("../../src/services/websites/service", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/websites/service")>()),
	cancelWebsiteWorkflow: mocks.cancelWebsiteWorkflow,
	editWebsite: mocks.editWebsite,
	getWebsite: mocks.getWebsite,
	getWebsiteRecord: mocks.getWebsiteRecord,
	publishWebsite: mocks.publishWebsite,
}));

vi.mock("../../src/services/websites/domain-registrations", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/websites/domain-registrations")>()),
	quoteDomain: mocks.quoteDomain,
}));

vi.mock("../../src/services/link-preview", () => ({
	getLinkPreview: mocks.getLinkPreview,
	LinkPreviewRateLimitError: mocks.LinkPreviewRateLimitError,
}));

vi.mock("../../src/services/websites/workflow-stream", () => ({
	streamWebsiteWorkflow: mocks.streamWebsiteWorkflow,
}));

const websiteId = "00000000-0000-4000-8000-000000000001";

const updatedAt = "2026-09-18T12:00:00.000Z";

const editBody = {
	edit: {
		operation: "delete",
		pageId: "00000000-0000-4000-8000-00000000000a",
		sectionId: "00000000-0000-4000-8000-00000000000b",
	},
	updatedAt,
	websiteId,
};

const call = async ({ body, path }: { body: object; path: string }) => {
	const { response } = await new RPCHandler({ websites }).handle(
		new Request(`http://localhost/api/rpc/websites/${path}`, {
			body: JSON.stringify({ json: body }),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		{ prefix: "/api/rpc" }
	);

	const payload = response?.headers.get("content-type")?.includes("application/json")
		? z.object({ json: z.object({ code: z.string().optional() }).passthrough() }).safeParse(await response.json())
				.data
		: undefined;

	return { code: payload?.json?.code, json: payload?.json, status: response?.status };
};

const quote = async () => {
	const { response } = await new RPCHandler({ domains }).handle(
		new Request("http://localhost/api/rpc/domains/quote", {
			body: JSON.stringify({ json: { domain: "example.com" } }),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		{ prefix: "/api/rpc" }
	);

	const payload = z
		.object({ json: z.object({ code: z.string().optional(), data: z.unknown().optional() }) })
		.safeParse(await response?.json()).data;

	return { code: payload?.json?.code, data: payload?.json?.data, status: response?.status };
};

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
	mocks.role = "owner";
	mocks.resolveSession.mockResolvedValue({ session: { activeOrganizationId: "org-1" }, user: { id: "user-1" } });
	mocks.requirePermission.mockImplementation(async ({ permission }: { permission: OrganizationPermission }) => {
		if (hasOrganizationPermission({ permission, role: mocks.role })) {
			return mocks.role;
		}

		throw new ORPCError("FORBIDDEN");
	});
	mocks.getLinkPreview.mockResolvedValue({
		description: "Description",
		favicon: null,
		siteName: "example.com",
		title: "Article",
		url,
	});
});

describe("websites router workflow scoping", () => {
	const streamBody = { websiteId, workflowRunId: "run-b" };

	it("returns NOT_FOUND for a website outside the organization", async () => {
		mocks.getWebsiteRecord.mockResolvedValue(null);
		const result = await call({ body: streamBody, path: "streamWorkflow" });
		expect(result.status).toBe(404);
		expect(mocks.getWebsiteRecord).toHaveBeenCalledWith({ organizationId: "org-1", websiteId });
		expect(mocks.streamWebsiteWorkflow).not.toHaveBeenCalled();
	});

	it("returns NOT_FOUND for a different workflow run", async () => {
		mocks.getWebsiteRecord.mockResolvedValue({ workflowRunId: "run-a" });
		const result = await call({ body: streamBody, path: "streamWorkflow" });
		expect(result.status).toBe(404);
		expect(mocks.streamWebsiteWorkflow).not.toHaveBeenCalled();
	});

	it("streams the matching workflow run", async () => {
		const record = { workflowRunId: "run-a" };
		mocks.getWebsiteRecord.mockResolvedValue(record);
		mocks.streamWebsiteWorkflow.mockReturnValue((async function* () {})());
		const result = await call({ body: { websiteId, workflowRunId: "run-a" }, path: "streamWorkflow" });
		expect(result.status).toBe(200);
		expect(mocks.streamWebsiteWorkflow).toHaveBeenCalledExactlyOnceWith({
			afterCursor: undefined,
			record,
			runId: "run-a",
		});
	});

	it("cancels only when the workflow exists and the caller can write", async () => {
		const body = { websiteId, workflowRunId: "run-a" };
		mocks.cancelWebsiteWorkflow.mockResolvedValue(false);
		const missing = await call({ body, path: "cancelWorkflow" });
		expect(missing.status).toBe(404);
		expect(missing.code).toBe("NOT_FOUND");

		mocks.cancelWebsiteWorkflow.mockResolvedValue(true);
		const cancelled = await call({ body, path: "cancelWorkflow" });
		expect(cancelled.status).toBe(200);
		expect(cancelled.json).toEqual({ cancelled: true });
		expect(mocks.cancelWebsiteWorkflow).toHaveBeenLastCalledWith({
			organizationId: "org-1",
			websiteId,
			workflowRunId: "run-a",
		});

		mocks.cancelWebsiteWorkflow.mockClear();
		mocks.role = "member";
		expect((await call({ body, path: "cancelWorkflow" })).status).toBe(403);
		expect(mocks.cancelWebsiteWorkflow).not.toHaveBeenCalled();
	});
});

describe("websites router mutation error mapping", () => {
	it.each([
		[new WebsiteMutationConflictError(), 409, "CONFLICT"],
		[new WebsiteDraftNotFoundError(), 404, "NOT_FOUND"],
	])("maps publish %s", async (error, status, code) => {
		mocks.publishWebsite.mockRejectedValue(error);
		const result = await call({ body: { updatedAt, websiteId }, path: "publish" });
		expect(result.status).toBe(status);
		expect(result.code).toBe(code);
	});

	it("blocks admin deletions before the edit service runs", async () => {
		mocks.role = "admin";
		expect((await call({ body: editBody, path: "edit" })).status).toBe(403);
		expect(mocks.editWebsite).not.toHaveBeenCalled();
	});

	it.each([
		[new WebsiteMutationConflictError(), 409, "CONFLICT"],
		[new WebsiteDraftNotFoundError(), 404, "NOT_FOUND"],
		[new WebsiteEditError(), 500, "INVALID_EDIT"],
		[new WebsiteTextTranslationError(), 503, "SERVICE_UNAVAILABLE"],
	])("maps owner edit %s", async (error, status, code) => {
		mocks.editWebsite.mockRejectedValue(error);
		const result = await call({ body: editBody, path: "edit" });
		expect(result.status).toBe(status);
		expect(result.code).toBe(code);
	});
});

describe("domains router error mapping", () => {
	it.each([
		[new DomainNotFoundError(), "NOT_FOUND", 404],
		[new DomainConflictError(), "CONFLICT", 409],
		[new DomainPurchaseDisabledError(), "PURCHASES_DISABLED", 500],
		[new DomainPriceChangedError(), "PRICE_CHANGED", 500],
		[new DomainSearchRateLimitError(), "RATE_LIMITED", 500],
		[new Error("provider down"), "PROVIDER_UNAVAILABLE", 500],
	])("maps %s to %s", async (error, code, status) => {
		mocks.quoteDomain.mockRejectedValue(error);
		const result = await quote();
		expect(result.code).toBe(code);
		expect(result.status).toBe(status);
	});

	it("includes the invalid registrant fields", async () => {
		mocks.quoteDomain.mockRejectedValue(new DomainRegistrantError(["address1", "phone"]));
		const result = await quote();
		expect(result.code).toBe("REGISTRANT_INVALID");
		expect(result.data).toEqual({ fields: ["address1", "phone"] });
	});

	it("passes ORPC errors through unchanged", async () => {
		mocks.quoteDomain.mockRejectedValue(new ORPCError("FORBIDDEN"));
		const result = await quote();
		expect(result.status).toBe(403);
		expect(result.code).toBe("FORBIDDEN");
	});

	it("rejects members before the provider is called", async () => {
		mocks.role = "member";
		expect((await quote()).status).toBe(403);
		expect(mocks.quoteDomain).not.toHaveBeenCalled();
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
