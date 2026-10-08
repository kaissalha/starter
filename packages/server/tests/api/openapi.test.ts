import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { getOpenAPIMeta, OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveSession = vi.hoisted(() => vi.fn());

const getNotificationSettings = vi.hoisted(() => vi.fn());

vi.mock("../../src/services/notifications/preferences", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/notifications/preferences")>()),
	getNotificationSettings,
}));

vi.mock("../../src/lib/auth", () => ({ resolveSession }));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers({ "x-api-key": "starter_test" })),
}));

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: vi.fn(async () => "owner"),
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

	it("publishes the complete Notification settings surface", async () => {
		const spec = await getPublicSpec();
		const operations = getOperations(spec);

		expect(
			operations.map(({ method, operation, path }) => ({ method, operationId: operation.operationId, path }))
		).toEqual([
			{ method: "get", operationId: "listNotificationSettings", path: "/notification-settings" },
			{ method: "put", operationId: "updateNotificationSetting", path: "/notification-settings" },
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
	beforeEach(() => {
		resolveSession.mockReset();
		getNotificationSettings.mockResolvedValue([]);

		resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});
	});

	it("rejects private and unknown procedures", async () => {
		const handler = createPublicApiHandler();

		for (const path of ["/chats", "/documents", "/library", "/link-previews", "/media", "/does-not-exist"]) {
			const { matched } = await handler.handle(new Request(`https://example.com/api/v1${path}`), {
				prefix: "/api/v1",
			});

			expect(matched, `GET ${path} must remain private`).toBe(false);
		}
	});

	it("executes a public procedure through the real authorization middleware", async () => {
		const handler = createPublicApiHandler();

		const { matched, response } = await handler.handle(
			new Request("https://example.com/api/v1/notification-settings", {
				headers: { "x-api-key": "starter_test" },
			}),
			{ context: { authMode: "session-or-api-key" }, prefix: "/api/v1" }
		);

		expect(matched).toBe(true);
		expect(response?.status).toBe(200);
		expect(await response?.json()).toEqual([]);
		expect(getNotificationSettings).toHaveBeenCalledWith({
			actor: { organizationId: "organization-1", userId: "user-1" },
		});
		expect(resolveSession).toHaveBeenCalledWith(expect.any(Headers), true);
	});

	it("maps missing authentication and organization context to HTTP errors", async () => {
		const handler = createPublicApiHandler();

		const request = () =>
			new Request("https://example.com/api/v1/notification-settings", {
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
