import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { getOpenAPIMeta, OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveSession = vi.hoisted(() => vi.fn());

const listBlogPosts = vi.hoisted(() => vi.fn());

const getContactInquirySummary = vi.hoisted(() => vi.fn());

const createContact = vi.hoisted(() => vi.fn());

vi.mock("../../src/services/contacts", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/contacts")>()),
	createContact,
	getContactInquirySummary,
}));

vi.mock("../../src/services/blog-posts", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/blog-posts")>()),
	listBlogPosts,
}));

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: vi.fn(async () => "owner"),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers({ "x-api-key": "starter_test" })),
}));

vi.mock("../../src/lib/auth", () => ({
	resolveSession,
}));

import { apiRouter, generateOpenApiSpec, isPublicApiProcedure } from "../../src/api/app";

const HTTP_METHODS = ["get", "put", "post", "delete", "patch"] as const;

type Spec = Awaited<ReturnType<typeof generateOpenApiSpec>>;

type ApiSecurityRequirement = { apiKeyAuth?: Array<string> };

const getPublicSpec = async (): Promise<Spec> => generateOpenApiSpec({ origin: "https://example.com" });

const getFutureSurfaceSpec = async () => {
	const generator = new OpenAPIGenerator({
		converters: [new ZodToJsonSchemaConverter()],
	});

	const spec = await generator.generate(apiRouter, {
		filter: (contract) => getOpenAPIMeta(contract)?.path !== undefined,
		version: "3.1.0",
	});

	return spec;
};

const getOperations = (spec: Spec) =>
	Object.entries(spec.paths ?? {}).flatMap(([path, pathItem]) =>
		HTTP_METHODS.flatMap((method) => {
			const operation = pathItem[method];

			return operation ? [{ method, operation, path }] : [];
		})
	);

const createPublicApiHandler = () =>
	new OpenAPIHandler(apiRouter, {
		filter: (contract) => isPublicApiProcedure(contract),
		plugins: [new SmartCoercionHandlerPlugin({ converters: [new ZodToJsonSchemaConverter()] })],
	});

describe("public OpenAPI document", () => {
	it("is an OpenAPI 3.1 document with servers and API key security scheme", async () => {
		const spec = await getPublicSpec();

		expect(spec.openapi).toMatch(/^3\.1\./);
		expect(spec.info.title).toBe("starter API");
		expect(spec.servers?.[0]?.url).toBe("https://example.com/api/v1");
		expect(spec.components?.securitySchemes).toHaveProperty("apiKeyAuth");
		expect(spec.components?.securitySchemes).toHaveProperty("betterAuthSession");
	});

	it("publishes the complete Analytics, Blog, Brand, Contacts, Domains, Links page, Notification settings and SEO surfaces", async () => {
		const spec = await getPublicSpec();
		const operations = getOperations(spec);

		expect(
			operations.map(({ method, operation, path }) => ({ method, operationId: operation.operationId, path }))
		).toEqual([
			{ method: "get", operationId: "getAnalyticsBreakdown", path: "/analytics/breakdowns" },
			{ method: "get", operationId: "getAnalyticsLive", path: "/analytics/live" },
			{ method: "get", operationId: "getAnalyticsOverview", path: "/analytics/overview" },
			{ method: "get", operationId: "getAnalyticsRealtime", path: "/analytics/realtime" },
			{ method: "get", operationId: "getAnalyticsWebVitals", path: "/analytics/web-vitals" },
			{ method: "post", operationId: "cancelBlogPostGeneration", path: "/blog-posts/{postId}/cancel" },
			{ method: "get", operationId: "listBlogPosts", path: "/blog-posts" },
			{ method: "post", operationId: "createBlogPost", path: "/blog-posts" },
			{ method: "get", operationId: "getBlogPost", path: "/blog-posts/{postId}" },
			{ method: "put", operationId: "updateBlogPost", path: "/blog-posts/{postId}" },
			{ method: "delete", operationId: "deleteBlogPost", path: "/blog-posts/{postId}" },
			{ method: "post", operationId: "generateBlogPost", path: "/blog-posts/{postId}/generate" },
			{ method: "post", operationId: "generateNewBlogPost", path: "/blog-posts/generate" },
			{ method: "get", operationId: "getBlogPostGenerationStatus", path: "/blog-posts/{postId}/generation" },
			{ method: "post", operationId: "publishBlogPost", path: "/blog-posts/{postId}/publish" },
			{
				method: "get",
				operationId: "streamBlogPostGeneration",
				path: "/blog-posts/{postId}/generation/{runId}/events",
			},
			{ method: "post", operationId: "translateBlogPost", path: "/blog-posts/{postId}/translate" },
			{ method: "post", operationId: "unpublishBlogPost", path: "/blog-posts/{postId}/unpublish" },
			{ method: "get", operationId: "getBrand", path: "/brand" },
			{ method: "patch", operationId: "updateBrand", path: "/brand" },
			{ method: "get", operationId: "listBrandOptions", path: "/brand/options" },
			{ method: "post", operationId: "publishBrand", path: "/brand/publish" },
			{ method: "put", operationId: "setBrandLogo", path: "/brand/logo" },
			{ method: "get", operationId: "listContacts", path: "/contacts" },
			{ method: "post", operationId: "createContact", path: "/contacts" },
			{ method: "get", operationId: "getContact", path: "/contacts/{contactId}" },
			{ method: "put", operationId: "updateContact", path: "/contacts/{contactId}" },
			{ method: "delete", operationId: "deleteContact", path: "/contacts/{contactId}" },
			{ method: "get", operationId: "getContactInquirySummary", path: "/contacts/inquiry-summary" },
			{ method: "get", operationId: "getContactMessage", path: "/contacts/{contactId}/messages/{messageId}" },
			{ method: "get", operationId: "listContactMessages", path: "/contacts/{contactId}/messages" },
			{
				method: "post",
				operationId: "triageContactMessage",
				path: "/contacts/{contactId}/messages/{messageId}/triage",
			},
			{ method: "post", operationId: "checkDomainAvailability", path: "/domains/availability" },
			{ method: "put", operationId: "changeDomainMethod", path: "/domains/{domainId}/method" },
			{ method: "get", operationId: "listDomains", path: "/domains" },
			{ method: "post", operationId: "connectDomain", path: "/domains" },
			{
				method: "delete",
				operationId: "deleteDomainDnsRecord",
				path: "/domains/{domainId}/dns-records/{recordId}",
			},
			{ method: "delete", operationId: "disconnectDomain", path: "/domains/{domainId}" },
			{ method: "post", operationId: "priceDomains", path: "/domains/prices" },
			{ method: "post", operationId: "purchaseDomain", path: "/domains/registrations" },
			{ method: "get", operationId: "quoteDomain", path: "/domains/quote" },
			{ method: "get", operationId: "listDomainDnsRecords", path: "/domains/{domainId}/dns-records" },
			{ method: "post", operationId: "saveDomainDnsRecord", path: "/domains/{domainId}/dns-records" },
			{
				method: "put",
				operationId: "setDomainAutoRenew",
				path: "/domains/registrations/{registrationId}/auto-renew",
			},
			{ method: "post", operationId: "setPrimaryDomain", path: "/domains/{domainId}/primary" },
			{ method: "get", operationId: "suggestDomains", path: "/domains/suggestions" },
			{ method: "put", operationId: "updateWebsiteSubdomain", path: "/domains/subdomain" },
			{ method: "post", operationId: "verifyDomain", path: "/domains/{domainId}/verify" },
			{ method: "get", operationId: "getCurrentLinkPage", path: "/link-pages/current" },
			{ method: "put", operationId: "saveLinkPage", path: "/link-pages/current" },
			{ method: "post", operationId: "publishLinkPage", path: "/link-pages/current/publish" },
			{ method: "get", operationId: "listNotificationSettings", path: "/notification-settings" },
			{ method: "put", operationId: "updateNotificationSetting", path: "/notification-settings" },
			{ method: "post", operationId: "exploreSeoPrompt", path: "/seo/prompt-explorer" },
			{ method: "get", operationId: "getGeoOverview", path: "/seo/geo-overview" },
			{ method: "get", operationId: "getSeoOverview", path: "/seo/overview" },
			{ method: "post", operationId: "refreshGeoQuestion", path: "/seo/geo-questions/{questionId}/refresh" },
			{ method: "get", operationId: "getSearchConsoleOverview", path: "/seo/search-console" },
		]);
	});

	it("declares only tag groups used by public operations", async () => {
		const spec = await getPublicSpec();
		const usedTags = new Set(getOperations(spec).flatMap(({ operation }) => operation.tags ?? []));

		expect(spec.tags?.map(({ name }) => name) ?? []).toEqual([...usedTags]);
		expect(spec.tags?.every(({ description }) => Boolean(description)) ?? true).toBe(true);
	});
});

describe("future public surface route metadata", () => {
	it("gives every routed procedure a unique operationId, a summary, tags, and API key security", async () => {
		const spec = await getFutureSurfaceSpec();
		const operations = getOperations(spec);

		expect(operations.length).toBeGreaterThan(0);

		const operationIds = operations.map(({ method, operation, path }) => {
			expect(operation.operationId, `${method.toUpperCase()} ${path} is missing an operationId`).toBeTruthy();
			expect(operation.summary, `${method.toUpperCase()} ${path} is missing a summary`).toBeTruthy();
			expect(operation.tags?.length, `${method.toUpperCase()} ${path} is missing tags`).toBeGreaterThan(0);

			expect(
				operation.security?.some((requirement: ApiSecurityRequirement) =>
					Object.hasOwn(requirement, "apiKeyAuth")
				),
				`${method.toUpperCase()} ${path} must advertise API key auth`
			).toBe(true);

			return operation.operationId;
		});

		expect(new Set(operationIds).size).toBe(operationIds.length);
	});

	it("uses RESTful kebab-case paths and keeps internal-forever procedures unrouted", async () => {
		const spec = await getFutureSurfaceSpec();
		const paths = Object.keys(spec.paths ?? {});

		expect(paths.length).toBeGreaterThan(0);

		for (const path of paths) {
			expect(path, `${path} must use kebab-case path segments`).toMatch(/^(\/(([a-z0-9-]+)|\{[a-zA-Z]+\}))+$/);
			expect(path.includes("link-preview"), `${path} must not route internal-forever procedures`).toBe(false);
			expect(path.startsWith("/auth"), `${path} must not document Better Auth endpoints`).toBe(false);
		}
	});
});

describe("public OpenAPI handler", () => {
	it("routes Blog independently with the authenticated actor and validates pagination", async () => {
		const handler = createPublicApiHandler();
		const output = { data: [], page: 2, pageSize: 20, total: 0 };
		listBlogPosts.mockResolvedValue(output);

		const { matched, response } = await handler.handle(
			new Request("https://example.com/api/v1/blog-posts?page=2"),
			{ context: { authMode: "session-or-api-key" }, prefix: "/api/v1" }
		);

		expect(matched).toBe(true);
		expect(response?.status).toBe(200);
		expect(await response?.json()).toEqual(output);
		expect(listBlogPosts).toHaveBeenCalledWith({
			actor: { organizationId: "organization-1", userId: "user-1" },
			input: { page: 2, pageSize: 20, search: "", status: "all" },
		});

		const invalid = await handler.handle(new Request("https://example.com/api/v1/blog-posts?page=-1"), {
			prefix: "/api/v1",
		});

		expect(invalid.response?.status).toBe(400);
	});
	it("routes static contact paths before contact IDs and records API as the event source", async () => {
		const handler = createPublicApiHandler();
		const context = { context: { authMode: "session-or-api-key" as const }, prefix: "/api/v1" as const };
		getContactInquirySummary.mockResolvedValue({ counts: [], total: 0 });
		createContact.mockResolvedValue({
			createdAt: "2026-09-25T00:00:00.000Z",
			email: "lead@example.com",
			id: "00000000-0000-4000-8000-000000000001",
			name: "Lead",
			phone: null,
		});

		const summary = await handler.handle(
			new Request("https://example.com/api/v1/contacts/inquiry-summary?days=7"),
			context
		);

		expect(summary.response?.status).toBe(200);
		expect(getContactInquirySummary).toHaveBeenCalledWith({
			actor: { organizationId: "organization-1", userId: "user-1" },
			input: { days: 7 },
		});

		const created = await handler.handle(
			new Request("https://example.com/api/v1/contacts", {
				body: JSON.stringify({ email: "lead@example.com", name: "Lead", phone: null }),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
			context
		);

		expect(created.response?.status).toBe(200);
		expect(createContact).toHaveBeenCalledWith(expect.objectContaining({ source: "api" }));
	});
	beforeEach(() => {
		resolveSession.mockReset();

		resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});
	});

	it("rejects private and unknown procedures", async () => {
		const handler = createPublicApiHandler();

		for (const path of ["/brands", "/chats", "/documents", "/link-previews", "/websites", "/does-not-exist"]) {
			const { matched } = await handler.handle(new Request(`https://example.com/api/v1${path}`), {
				prefix: "/api/v1",
			});

			expect(matched, `GET ${path} must remain private`).toBe(false);
		}

		const { matched } = await handler.handle(
			new Request("https://example.com/api/v1/domains/registrations/reg-1/transfer-code", {
				body: "{}",
				headers: { "content-type": "application/json", "x-api-key": "starter_test" },
				method: "POST",
			}),
			{ context: { authMode: "session-or-api-key" }, prefix: "/api/v1" }
		);

		expect(matched, "POST transfer-code must remain private").toBe(false);
	});

	it("executes a public procedure through the real authorization middleware", async () => {
		const handler = createPublicApiHandler();

		const { matched, response } = await handler.handle(
			new Request("https://example.com/api/v1/brand/options", {
				headers: { "x-api-key": "starter_test" },
			}),
			{ context: { authMode: "session-or-api-key" }, prefix: "/api/v1" }
		);

		expect(matched).toBe(true);
		expect(response?.status).toBe(200);

		expect(await response?.json()).toMatchObject({
			cornerStyles: expect.any(Array),
			fontPairings: expect.any(Object),
		});

		expect(resolveSession).toHaveBeenCalledWith(expect.any(Headers), true);
	});

	it("maps missing authentication and organization context to HTTP errors", async () => {
		const handler = createPublicApiHandler();

		const request = () =>
			new Request("https://example.com/api/v1/brand/options", {
				headers: { "x-api-key": "starter_test" },
			});

		resolveSession.mockResolvedValueOnce(null);
		const unauthenticated = await handler.handle(request(), { prefix: "/api/v1" });
		expect(unauthenticated.response?.status).toBe(401);

		resolveSession.mockResolvedValueOnce({
			session: { activeOrganizationId: null },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});

		const organizationMissing = await handler.handle(request(), { prefix: "/api/v1" });
		expect(organizationMissing.response?.status).toBe(400);
	});
});
