import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
	process.env.AI_GATEWAY_API_KEY ??= "test-gateway-key";
});

const mocks = vi.hoisted<{
	getNotificationSettings: ReturnType<typeof vi.fn>;
	mcpAuthOptions?: { requiredScopes?: Array<string>; resource?: string };
	oauthHandler: ReturnType<typeof vi.fn>;
	resolveSession: ReturnType<typeof vi.fn>;
}>(() => ({
	getNotificationSettings: vi.fn(async () => ({ settings: [] })),
	mcpAuthOptions: undefined,
	oauthHandler: vi.fn(async () => new Response("oauth")),
	resolveSession: vi.fn(),
}));

const permissionMocks = vi.hoisted<{
	requireOrganizationPermission: ReturnType<typeof vi.fn>;
	role: string | null;
}>(() => ({
	requireOrganizationPermission: vi.fn(),
	role: "owner",
}));

vi.mock("../../src/services/notifications/preferences", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/notifications/preferences")>()),
	getNotificationSettings: mocks.getNotificationSettings,
}));

vi.mock("../../src/services/permissions", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/permissions")>()),
	requireOrganizationPermission: permissionMocks.requireOrganizationPermission,
}));

vi.mock("@better-auth/mcp", () => ({
	requireMcpAuth: vi.fn((_auth, _handler, options) => {
		mocks.mcpAuthOptions = options;

		return mocks.oauthHandler;
	}),
}));

vi.mock("../../src/lib/auth", () => ({
	auth: {},
	getApiKeyFromHeaders: (headers: Headers) => {
		const bearer = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

		return headers.get("x-api-key") ?? (bearer?.startsWith("starter_") ? bearer : undefined);
	},
	MCP_RESOURCE: "https://starter.example/api/mcp",
	ORGANIZATION_ID_CLAIM: "https://starter.example/claims/organization-id",
	resolveOrganizationSession: vi.fn(),
	resolveSession: mocks.resolveSession,
}));

import { handleMcpRequest } from "../../src/api/mcp";
import { hasOrganizationPermission, type OrganizationPermission } from "../../src/utils/permissions";

const mcpHeaders = {
	accept: "application/json, text/event-stream",
	"content-type": "application/json",
	"mcp-protocol-version": "2025-06-18",
	"x-api-key": "starter_test",
};

const mcpRequest = (body: { method: string; params: { arguments?: Record<string, string>; name?: string } }) =>
	new Request("https://starter.example/api/mcp", {
		body: JSON.stringify({ id: 1, jsonrpc: "2.0", ...body }),
		headers: mcpHeaders,
		method: "POST",
	});

const toolRequest = (name: string, args: Record<string, string> = {}) =>
	mcpRequest({ method: "tools/call", params: { arguments: args, name } });

describe("MCP route", () => {
	beforeEach(() => {
		permissionMocks.role = "owner";
		permissionMocks.requireOrganizationPermission.mockReset();
		permissionMocks.requireOrganizationPermission.mockImplementation(
			async ({ permission }: { permission: OrganizationPermission }) => {
				if (!hasOrganizationPermission({ permission, role: permissionMocks.role })) {
					throw new ORPCError("FORBIDDEN", { message: "Permission denied" });
				}

				return permissionMocks.role;
			}
		);
		mocks.getNotificationSettings.mockClear();
		mocks.oauthHandler.mockClear();
		mocks.resolveSession.mockReset();
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});
	});

	it("exposes notification settings and derives the actor from authentication", async () => {
		const list = await (await handleMcpRequest(mcpRequest({ method: "tools/list", params: {} }))).text();

		for (const name of ["list_notification_settings", "update_notification_setting"]) {
			expect(list).toContain(`"name":"${name}"`);
		}

		permissionMocks.role = "member";

		const read = await handleMcpRequest(
			toolRequest("list_notification_settings", { organizationId: "organization-2" })
		);

		expect(await read.text()).toContain("settings");
		expect(mocks.getNotificationSettings).toHaveBeenCalledWith({
			actor: { organizationId: "organization-1", userId: "user-1" },
		});
	});

	it("rejects removed members before exposing MCP tools", async () => {
		permissionMocks.role = null;
		await expect(handleMcpRequest(toolRequest("list_notification_settings"))).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(mocks.getNotificationSettings).not.toHaveBeenCalled();
	});

	it("falls back to the legacy MCP protocol", async () => {
		const response = await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				body: JSON.stringify({
					id: 1,
					jsonrpc: "2.0",
					method: "initialize",
					params: {
						capabilities: {},
						clientInfo: { name: "legacy-client", version: "1.0.0" },
						protocolVersion: "2025-06-18",
					},
				}),
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
					"x-api-key": "starter_test",
				},
				method: "POST",
			})
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/event-stream");

		const body = await response.text();

		expect(body).toContain('"protocolVersion":"2025-06-18"');
		expect(body).toContain('"tools"');
		expect(mocks.oauthHandler).not.toHaveBeenCalled();
	});

	it("delegates bearer access tokens to the OAuth Provider handler", async () => {
		const request = new Request("https://starter.example/api/mcp", {
			headers: { authorization: "Bearer oauth-token" },
			method: "POST",
		});

		const response = await handleMcpRequest(request);

		expect(await response.text()).toBe("oauth");
		expect(mocks.oauthHandler).toHaveBeenCalledWith(request);

		expect(mocks.mcpAuthOptions).toEqual({
			requiredScopes: ["mcp"],
			resource: "https://starter.example/api/mcp",
		});

		expect(mocks.resolveSession).not.toHaveBeenCalled();
	});

	it("returns OAuth discovery metadata for an invalid API key", async () => {
		mocks.resolveSession.mockResolvedValue(null);

		mocks.oauthHandler.mockResolvedValueOnce(
			new Response("Unauthorized", {
				headers: {
					"WWW-Authenticate":
						'Bearer resource_metadata="https://starter.example/.well-known/oauth-protected-resource/api/mcp"',
				},
				status: 401,
			})
		);

		const response = await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				headers: { authorization: "Bearer starter_invalid" },
				method: "POST",
			})
		);

		expect(response.status).toBe(401);

		expect(response.headers.get("WWW-Authenticate")).toBe(
			'Bearer resource_metadata="https://starter.example/.well-known/oauth-protected-resource/api/mcp"'
		);

		expect(mocks.oauthHandler).toHaveBeenCalledOnce();
	});
});
