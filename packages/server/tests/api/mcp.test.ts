import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
	process.env.AI_GATEWAY_API_KEY ??= "test-gateway-key";
});

const mocks = vi.hoisted<{
	getBrand: ReturnType<typeof vi.fn>;
	getLinkPage: ReturnType<typeof vi.fn>;
	mcpAuthOptions?: { requiredScopes?: Array<string>; resource?: string };
	oauthHandler: ReturnType<typeof vi.fn>;
	publishBrand: ReturnType<typeof vi.fn>;
	publishLinkPage: ReturnType<typeof vi.fn>;
	resolveSession: ReturnType<typeof vi.fn>;
	saveLinkPage: ReturnType<typeof vi.fn>;
	updateBrand: ReturnType<typeof vi.fn>;
}>(() => ({
	getBrand: vi.fn(),
	getLinkPage: vi.fn(),
	mcpAuthOptions: undefined,
	oauthHandler: vi.fn(async () => new Response("oauth")),
	publishBrand: vi.fn(),
	publishLinkPage: vi.fn(),
	resolveSession: vi.fn(),
	saveLinkPage: vi.fn(),
	updateBrand: vi.fn(),
}));

const contactMocks = vi.hoisted(() => ({ deleteContact: vi.fn(), updateContact: vi.fn() }));

const domainMocks = vi.hoisted(() => ({
	disconnectWebsiteDomain: vi.fn(),
	listWebsiteDomains: vi.fn(),
	requireDomainScope: vi.fn(),
}));

const seoMocks = vi.hoisted(() => ({
	exploreSeoPrompt: vi.fn(),
	getGeoOverview: vi.fn(),
	refreshGeoQuestion: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({ realtime: vi.fn(async () => ({ visitors: 3 })) }));

vi.mock("../../src/services/analytics", async (original) => ({
	...(await original<typeof import("../../src/services/analytics")>()),
	getAnalyticsRealtime: analyticsMocks.realtime,
}));

const permissionMocks = vi.hoisted<{
	requireOrganizationPermission: ReturnType<typeof vi.fn>;
	role: string | null;
}>(() => ({
	requireOrganizationPermission: vi.fn(),
	role: "owner",
}));

vi.mock("../../src/services/contacts", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/contacts")>()),
	...contactMocks,
}));

vi.mock("../../src/services/websites/domains", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/websites/domains")>()),
	...domainMocks,
}));

vi.mock("../../src/services/seo/prompt-explorer", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/seo/prompt-explorer")>()),
	...seoMocks,
}));

vi.mock("../../src/services/link-pages", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/link-pages")>()),
	getLinkPage: mocks.getLinkPage,
	publishLinkPage: mocks.publishLinkPage,
	saveLinkPage: mocks.saveLinkPage,
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
	resolveOAuthSession: vi.fn(),
	resolveSession: mocks.resolveSession,
}));

vi.mock("../../src/services/brands", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../src/services/brands")>();

	return {
		...actual,
		getBrand: mocks.getBrand,
		publishBrand: mocks.publishBrand,
		updateBrand: mocks.updateBrand,
	};
});

import { brandFontPairings } from "@starter/infinite-brand";
import { defaultLinkPageBrand } from "@starter/infinite-links/contracts";
import { createDefaultLinkPageDocument } from "@starter/infinite-links/document";
import type { JsonValue } from "@starter/infinite-website";

import { handleMcpRequest } from "../../src/api/mcp";
import { hasOrganizationPermission, type OrganizationPermission } from "../../src/utils/permissions";

const brandState = {
	brand: {
		colors: {
			background: "#ffffff",
			neutral: "#64748b",
			primary: "#2457d6",
			secondary: "#0f172a",
			tertiary: "#e2e8f0",
		},
		corners: { style: "rounded" as const },
		defaultLocale: "en",
		locales: ["en"],
		schemaVersion: 1 as const,
		typography: { catalogVersion: 1 as const, ...brandFontPairings.minimal },
	},
	publication: { hasUnpublishedChanges: true, publishedAt: null },
	updatedAt: "2026-08-22T12:00:00.000Z",
};

const linkPageState = {
	document: createDefaultLinkPageDocument({ name: "Northstar" }),
	id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
	inheritedBrand: defaultLinkPageBrand,
	publication: { hasUnpublishedChanges: true, publishedAt: null },
	updatedAt: "2026-09-03T12:00:00.000Z",
};

const mcpHeaders = {
	accept: "application/json, text/event-stream",
	"content-type": "application/json",
	"mcp-protocol-version": "2025-06-18",
	"x-api-key": "starter_test",
};

const toolRequest = (name: string, args: Record<string, JsonValue> = {}) =>
	new Request("https://starter.example/api/mcp", {
		body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/call", params: { arguments: args, name } }),
		headers: mcpHeaders,
		method: "POST",
	});

const callAs = async (role: string, name: string, args: Record<string, JsonValue> = {}) => {
	permissionMocks.role = role;
	mocks.resolveSession.mockResolvedValue({
		session: { activeOrganizationId: "organization-1" },
		user: { id: "user-1" },
	});

	return (await handleMcpRequest(toolRequest(name, args))).text();
};

describe("MCP route", () => {
	it("registers read-only analytics and derives its tenant from authentication", async () => {
		permissionMocks.role = "member";
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { id: "user-1" },
		});
		analyticsMocks.realtime.mockClear();
		const response = await handleMcpRequest(toolRequest("get_analytics_realtime"));
		expect(await response.text()).toContain('"visitors":3');
		expect(analyticsMocks.realtime).toHaveBeenCalledWith({
			actor: { organizationId: "organization-1", userId: "user-1" },
			input: { domain: "", locale: "" },
		});

		const forged = await handleMcpRequest(
			toolRequest("get_analytics_realtime", { organizationId: "organization-2" })
		);

		expect(await forged.text()).toContain('"isError":true');
		expect(analyticsMocks.realtime).toHaveBeenCalledOnce();
		permissionMocks.role = null;
		await expect(handleMcpRequest(toolRequest("get_analytics_realtime"))).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});
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
		mocks.getBrand.mockReset();
		mocks.getBrand.mockResolvedValue(brandState);
		mocks.getLinkPage.mockReset();
		mocks.getLinkPage.mockResolvedValue(linkPageState);
		mocks.oauthHandler.mockClear();
		mocks.publishBrand.mockReset();
		mocks.publishBrand.mockResolvedValue(brandState);
		mocks.publishLinkPage.mockReset();
		mocks.publishLinkPage.mockResolvedValue(linkPageState);
		mocks.resolveSession.mockReset();
		mocks.saveLinkPage.mockReset();
		mocks.saveLinkPage.mockResolvedValue(linkPageState);
		mocks.updateBrand.mockReset();
		mocks.updateBrand.mockResolvedValue(brandState);
	});

	it.each([
		{ role: "owner", writeCalls: 1, writeResult: '"primary":"#2457d6"' },
		{ role: "admin", writeCalls: 1, writeResult: '"primary":"#2457d6"' },
		{ role: "member", writeCalls: 0, writeResult: '"isError":true' },
	])("uses live $role permissions for MCP reads and writes", async ({ role, writeCalls, writeResult }) => {
		permissionMocks.role = role;
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1", role: "owner" },
			user: { id: "user-1" },
		});
		const read = await handleMcpRequest(toolRequest("get_brand"));
		expect(await read.text()).toContain('"primary":"#2457d6"');
		const update = { colors: { primary: "#2457d6" } };
		const write = await handleMcpRequest(toolRequest("update_brand", { revision: brandState.updatedAt, update }));
		expect(await write.text()).toContain(writeResult);
		expect(mocks.updateBrand).toHaveBeenCalledTimes(writeCalls);
		expect(permissionMocks.requireOrganizationPermission).toHaveBeenLastCalledWith({
			organizationId: "organization-1",
			permission: "write",
			userId: "user-1",
		});
	});

	it("rechecks permission at MCP execution after authorization at handler creation", async () => {
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { id: "user-1" },
		});
		permissionMocks.role = "member";
		permissionMocks.requireOrganizationPermission.mockResolvedValueOnce("owner");
		const response = await handleMcpRequest(toolRequest("publish_brand", { revision: brandState.updatedAt }));
		expect(await response.text()).toContain('"isError":true');
		expect(mocks.publishBrand).not.toHaveBeenCalled();
		expect(permissionMocks.requireOrganizationPermission).toHaveBeenCalledTimes(2);
	});

	it("rejects removed members before exposing MCP tools", async () => {
		permissionMocks.role = null;
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { id: "user-1" },
		});
		await expect(handleMcpRequest(toolRequest("get_brand"))).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.getBrand).not.toHaveBeenCalled();
	});

	it.each([
		["save_link_page", { document: linkPageState.document, updatedAt: linkPageState.updatedAt }],
		["publish_link_page", { updatedAt: linkPageState.updatedAt }],
	])("rejects Member %s before any Links write", async (name, args) => {
		permissionMocks.role = "member";
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { id: "user-1" },
		});
		const response = await handleMcpRequest(toolRequest(name, args));
		expect(await response.text()).toContain('"isError":true');
		expect(mocks.saveLinkPage).not.toHaveBeenCalled();
		expect(mocks.publishLinkPage).not.toHaveBeenCalled();
	});

	it.each([
		["explore_seo_prompt", { locale: "en", prompt: "Which studio should I choose?" }, seoMocks.exploreSeoPrompt],
		[
			"refresh_geo_question",
			{ mode: "sample", questionId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d" },
			seoMocks.refreshGeoQuestion,
		],
	])("rejects Member %s before any model call", async (name, args, service) => {
		expect(await callAs("member", name, args)).toContain('"isError":true');
		expect(service).not.toHaveBeenCalled();
	});

	it("lets an Admin explore an SEO prompt after a write check", async () => {
		seoMocks.exploreSeoPrompt.mockResolvedValue({ brand: "North", location: "Toronto", prompt: "p", results: [] });

		const text = await callAs("admin", "explore_seo_prompt", {
			locale: "en",
			prompt: "Which studio should I choose?",
		});

		expect(text).not.toContain('"isError":true');
		expect(seoMocks.exploreSeoPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: "organization-1" })
		);
		expect(permissionMocks.requireOrganizationPermission).toHaveBeenLastCalledWith({
			organizationId: "organization-1",
			permission: "write",
			userId: "user-1",
		});
	});

	it("lets a Member read the GEO overview", async () => {
		seoMocks.getGeoOverview.mockResolvedValue({ business: null, samples: [] });
		expect(await callAs("member", "get_geo_overview", { locale: "en" })).toContain('"samples":[]');
		expect(seoMocks.getGeoOverview).toHaveBeenCalledWith({ locale: "en", organizationId: "organization-1" });
	});

	it("falls back to the legacy MCP protocol", async () => {
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});

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

	it("lists every Brand tool and scopes calls to the authenticated organization", async () => {
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});

		const listResponse = await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				body: JSON.stringify({ id: 2, jsonrpc: "2.0", method: "tools/list", params: {} }),
				headers: mcpHeaders,
				method: "POST",
			})
		);

		const listBody = await listResponse.text();

		expect(listBody).toContain('"name":"get_brand"');

		for (const name of [
			"list_blog_posts",
			"get_blog_post",
			"create_blog_post",
			"update_blog_post",
			"publish_blog_post",
			"unpublish_blog_post",
			"delete_blog_post",
			"generate_blog_post",
			"translate_blog_post",
			"cancel_blog_post_generation",
			"generate_new_blog_post",
			"get_blog_post_generation_status",
		]) {
			expect(listBody).toContain(`"name":"${name}"`);
		}

		expect(listBody).toContain('"name":"list_brand_options"');
		expect(listBody).toContain('"name":"update_brand"');
		expect(listBody).toContain('"name":"publish_brand"');

		const callResponse = await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				body: JSON.stringify({
					id: 3,
					jsonrpc: "2.0",
					method: "tools/call",
					params: { arguments: {}, name: "get_brand" },
				}),
				headers: mcpHeaders,
				method: "POST",
			})
		);

		const callBody = await callResponse.text();

		expect(callBody).toContain('"primary":"#2457d6"');
		expect(mocks.getBrand).toHaveBeenCalledWith({ organizationId: "organization-1" });

		await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				body: JSON.stringify({
					id: 4,
					jsonrpc: "2.0",
					method: "tools/call",
					params: {
						arguments: {
							revision: brandState.updatedAt,
							update: { colors: { primary: "#123456" } },
						},
						name: "update_brand",
					},
				}),
				headers: mcpHeaders,
				method: "POST",
			})
		);

		expect(mocks.updateBrand).toHaveBeenCalledWith({
			expected: { revision: brandState.updatedAt },
			organizationId: "organization-1",
			update: { colors: { primary: "#123456" } },
		});

		await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				body: JSON.stringify({
					id: 5,
					jsonrpc: "2.0",
					method: "tools/call",
					params: {
						arguments: { revision: brandState.updatedAt },
						name: "publish_brand",
					},
				}),
				headers: mcpHeaders,
				method: "POST",
			})
		);

		expect(mocks.publishBrand).toHaveBeenCalledWith({
			expected: { revision: brandState.updatedAt },
			organizationId: "organization-1",
		});
	});

	it("lists every Links page tool and scopes calls to the authenticated organization", async () => {
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});

		const listResponse = await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				body: JSON.stringify({ id: 6, jsonrpc: "2.0", method: "tools/list", params: {} }),
				headers: mcpHeaders,
				method: "POST",
			})
		);

		const listBody = await listResponse.text();

		expect(listBody).toContain('"name":"get_link_page"');
		expect(listBody).toContain('"name":"save_link_page"');
		expect(listBody).toContain('"name":"publish_link_page"');

		const getResponse = await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				body: JSON.stringify({
					id: 7,
					jsonrpc: "2.0",
					method: "tools/call",
					params: { arguments: {}, name: "get_link_page" },
				}),
				headers: mcpHeaders,
				method: "POST",
			})
		);

		expect(await getResponse.text()).toContain('"title":{"en":"Northstar"');
		expect(mocks.getLinkPage).toHaveBeenCalledWith({ organizationId: "organization-1" });

		await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				body: JSON.stringify({
					id: 8,
					jsonrpc: "2.0",
					method: "tools/call",
					params: {
						arguments: {
							document: linkPageState.document,
							updatedAt: linkPageState.updatedAt,
						},
						name: "save_link_page",
					},
				}),
				headers: mcpHeaders,
				method: "POST",
			})
		);

		expect(mocks.saveLinkPage).toHaveBeenCalledWith({
			document: linkPageState.document,
			organizationId: "organization-1",
			updatedAt: linkPageState.updatedAt,
			userId: "user-1",
		});

		await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				body: JSON.stringify({
					id: 9,
					jsonrpc: "2.0",
					method: "tools/call",
					params: {
						arguments: { updatedAt: linkPageState.updatedAt },
						name: "publish_link_page",
					},
				}),
				headers: mcpHeaders,
				method: "POST",
			})
		);

		expect(mocks.publishLinkPage).toHaveBeenCalledWith({
			organizationId: "organization-1",
			updatedAt: linkPageState.updatedAt,
		});
	});

	it("exposes all Contacts capabilities and scopes approved-client mutations to the authenticated actor", async () => {
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});

		const list = await handleMcpRequest(
			new Request("https://starter.example/api/mcp", {
				body: JSON.stringify({ id: 10, jsonrpc: "2.0", method: "tools/list", params: {} }),
				headers: mcpHeaders,
				method: "POST",
			})
		);

		const body = await list.text();

		for (const name of [
			"list_contacts",
			"get_contact",
			"create_contact",
			"update_contact",
			"delete_contact",
			"list_contact_messages",
			"get_contact_message",
			"get_contact_inquiry_summary",
			"triage_contact_message",
		]) {
			expect(body).toContain(`"name":"${name}"`);
		}

		expect(body).toContain('"destructiveHint":true');
		const id = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d330";
		const input = { contactId: id, email: null, name: "Ada", phone: null };
		contactMocks.updateContact.mockResolvedValue({
			createdAt: "2026-09-06T00:00:00.000Z",
			email: null,
			id,
			name: "Ada",
			phone: null,
		});
		contactMocks.deleteContact.mockResolvedValue({ id });

		for (const [name, args] of [
			["update_contact", input],
			["delete_contact", { contactId: id }],
		] as const) {
			const response = await handleMcpRequest(
				new Request("https://starter.example/api/mcp", {
					body: JSON.stringify({
						id: 11,
						jsonrpc: "2.0",
						method: "tools/call",
						params: { arguments: args, name },
					}),
					headers: mcpHeaders,
					method: "POST",
				})
			);

			expect(await response.text()).toContain(`"id":"${id}"`);
		}

		const actor = { organizationId: "organization-1", userId: "user-1" };
		expect(contactMocks.updateContact).toHaveBeenCalledWith({ actor, input, source: "mcp" });
		expect(contactMocks.deleteContact).toHaveBeenCalledWith({ actor, contactId: id, source: "mcp" });
	});

	it("exposes Domains and Notification settings and resolves the website from the authenticated organization", async () => {
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: "organization-1" },
			user: { email: "user@example.com", id: "user-1", name: "User" },
		});

		const call = async (body: { method: string; params: { arguments?: Record<string, string>; name?: string } }) =>
			(
				await handleMcpRequest(
					new Request("https://starter.example/api/mcp", {
						body: JSON.stringify({ id: 12, jsonrpc: "2.0", ...body }),
						headers: mcpHeaders,
						method: "POST",
					})
				)
			).text();

		const list = await call({ method: "tools/list", params: {} });

		for (const name of [
			"list_domains",
			"connect_domain",
			"purchase_domain",
			"save_domain_dns_record",
			"list_notification_settings",
			"update_notification_setting",
		]) {
			expect(list).toContain(`"name":"${name}"`);
		}

		expect(list).not.toContain("transfer_code");
		const scope = { organizationId: "organization-1", websiteId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d" };
		const domainId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d331";
		domainMocks.requireDomainScope.mockResolvedValue(scope);
		domainMocks.listWebsiteDomains.mockResolvedValue({ address: "northstar.example", domains: [] });
		domainMocks.disconnectWebsiteDomain.mockResolvedValue({ address: "northstar.example", domains: [] });
		expect(await call({ method: "tools/call", params: { arguments: {}, name: "list_domains" } })).toContain(
			"northstar.example"
		);
		await call({ method: "tools/call", params: { arguments: { domainId }, name: "disconnect_domain" } });
		const actor = { organizationId: "organization-1", userId: "user-1" };
		expect(domainMocks.requireDomainScope).toHaveBeenNthCalledWith(1, { ...actor, permission: "read" });
		expect(domainMocks.requireDomainScope).toHaveBeenNthCalledWith(2, { ...actor, permission: "delete" });
		expect(domainMocks.listWebsiteDomains).toHaveBeenCalledWith(scope);
		expect(domainMocks.disconnectWebsiteDomain).toHaveBeenCalledWith({ ...scope, domainId });
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
