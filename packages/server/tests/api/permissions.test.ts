import { ORPCError } from "@orpc/client";
import { call as callProcedure, walkProcedureContractsSync } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasOrganizationPermission, type OrganizationPermission } from "../../src/utils/permissions";

const actor = vi.hoisted(() => ({ role: "member" }));

const mocks = vi.hoisted(() => ({ requireOrganizationPermission: vi.fn(), resolveSession: vi.fn() }));

vi.mock("../../src/lib/auth", () => ({
	resolveSession: mocks.resolveSession,
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: mocks.requireOrganizationPermission,
}));

const geo = vi.hoisted(() => ({ getGeoOverview: vi.fn(), seedGeoOverview: vi.fn() }));

vi.mock("../../src/services/seo/prompt-explorer", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/seo/prompt-explorer")>()),
	getGeoOverview: geo.getGeoOverview,
	seedGeoOverview: geo.seedGeoOverview,
}));

import { apiRouter } from "../../src/api/app";
import { authedWithOrganization, organizationPermission } from "../../src/api/base";

beforeEach(() => {
	mocks.resolveSession.mockResolvedValue({ session: { activeOrganizationId: "org-1" }, user: { id: "user-1" } });
	mocks.requireOrganizationPermission.mockReset();
	mocks.requireOrganizationPermission.mockImplementation(
		async ({ permission }: { permission: OrganizationPermission }) => {
			if (!hasOrganizationPermission({ permission, role: actor.role })) {
				throw new ORPCError("FORBIDDEN");
			}

			return actor.role;
		}
	);
});

const handler = new RPCHandler(apiRouter);

const call = async (path: string, json: Record<string, string> = {}) => {
	const { response } = await handler.handle(
		new Request(`http://localhost/api/rpc/${path}`, {
			body: JSON.stringify({ json }),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		{ prefix: "/api/rpc" }
	);

	return response?.status;
};

const modelBackedWithInput = [
	"brands/recommend",
	"library/generateLogo",
	"linkPages/recommendTheme",
	"seo/explorePrompt",
	"seo/refreshGeoQuestion",
	"seo/seedGeoOverview",
	"websites/previewLayout",
	"websites/previewSection",
	"websites/previewTemplate",
	"websites/recommendLayout",
	"websites/recommendTemplate",
];

describe("organization RPC permissions", () => {
	beforeEach(() => {
		actor.role = "member";
	});
	it.each(modelBackedWithInput)("lets an admin past the permission gate for %s", async (path) => {
		actor.role = "admin";
		expect(await call(path)).not.toBe(403);
	});
	it("lets a member read the GEO overview without seeding it", async () => {
		geo.getGeoOverview.mockResolvedValue({ business: null, samples: [] });
		expect(await call("seo/geoOverview", { locale: "en" })).toBe(200);
		expect(geo.getGeoOverview).toHaveBeenCalledWith({ locale: "en", organizationId: "org-1" });
		expect(geo.seedGeoOverview).not.toHaveBeenCalled();
	});
	it("rejects reads when the stored membership is no longer available", async () => {
		actor.role = "";
		expect(await call("contacts/list")).toBe(403);
	});
});

type GuardLevel = "delete" | "read" | "write";

const levels = {
	"analytics/breakdown": "read",
	"analytics/live": "read",
	"analytics/overview": "read",
	"analytics/realtime": "read",
	"analytics/webVitals": "read",
	"blogPosts/cancel": "write",
	"blogPosts/create": "write",
	"blogPosts/delete": "delete",
	"blogPosts/generate": "write",
	"blogPosts/generateNew": "write",
	"blogPosts/generationStatus": "read",
	"blogPosts/get": "read",
	"blogPosts/list": "read",
	"blogPosts/publish": "write",
	"blogPosts/streamGeneration": "read",
	"blogPosts/translate": "write",
	"blogPosts/unpublish": "delete",
	"blogPosts/update": "write",
	"brands/get": "read",
	"brands/listOptions": "read",
	"brands/publish": "write",
	"brands/recommend": "write",
	"brands/setLogo": "write",
	"brands/update": "write",
	"chats/cancelStream": "write",
	"chats/list": "read",
	"chats/messages": "read",
	"contacts/create": "write",
	"contacts/delete": "delete",
	"contacts/get": "read",
	"contacts/inquirySummary": "read",
	"contacts/list": "read",
	"contacts/message": "read",
	"contacts/messages": "read",
	"contacts/triage": "read",
	"contacts/update": "write",
	"documents/create": "write",
	"documents/delete": "delete",
	"documents/findUpload": "read",
	"documents/get": "read",
	"domains/availability": "write",
	"domains/changeMethod": "write",
	"domains/connect": "write",
	"domains/deleteRecord": "delete",
	"domains/disconnect": "delete",
	"domains/list": "read",
	"domains/prices": "write",
	"domains/purchase": "write",
	"domains/quote": "write",
	"domains/records": "read",
	"domains/saveRecord": "write",
	"domains/setAutoRenew": "write",
	"domains/setPrimary": "write",
	"domains/suggest": "write",
	"domains/transferCode": "delete",
	"domains/updateSubdomain": "write",
	"domains/verify": "write",
	"library/agentChat": "write",
	"library/delete": "delete",
	"library/generateLogo": "write",
	"library/get": "read",
	"library/list": "read",
	"library/update": "write",
	"linkPages/agentChat": "write",
	"linkPages/get": "read",
	"linkPages/publish": "write",
	"linkPages/recommendTheme": "write",
	"linkPages/save": "write",
	"linkPreviews/get": "read",
	"media/delete": "delete",
	"media/list": "read",
	"media/searchStock": "read",
	"media/selectStock": "write",
	"notifications/archive": "read",
	"notifications/archiveAll": "read",
	"notifications/counts": "read",
	"notifications/list": "read",
	"notifications/markRead": "read",
	"notifications/markSeen": "read",
	"notificationSettings/getAll": "read",
	"notificationSettings/update": "read",
	"seo/explorePrompt": "write",
	"seo/geoOverview": "read",
	"seo/overview": "read",
	"seo/refreshGeoQuestion": "write",
	"seo/searchConsole": "read",
	"seo/seedGeoOverview": "write",
	"websites/addSection": "write",
	"websites/agentChat": "read",
	"websites/cancelWorkflow": "write",
	"websites/changeTemplate": "delete",
	"websites/edit": "write",
	"websites/generate": "write",
	"websites/generateLayout": "delete",
	"websites/get": "read",
	"websites/previewLayout": "write",
	"websites/previewSection": "write",
	"websites/previewTemplate": "write",
	"websites/publish": "write",
	"websites/recommendLayout": "write",
	"websites/recommendTemplate": "write",
	"websites/regenerateText": "write",
	"websites/restyleTemplate": "delete",
	"websites/sectionCatalog": "read",
	"websites/sectionPreviews": "read",
	"websites/streamWorkflow": "read",
	"websites/templateRecommendations": "write",
	"websites/templates": "read",
	"websites/unpublish": "write",
} satisfies Record<string, GuardLevel>;

const pathsAt = (...wanted: Array<GuardLevel>) =>
	Object.entries(levels)
		.filter(([, level]) => wanted.includes(level))
		.map(([path]) => path);

describe("role permission matrix", () => {
	beforeEach(() => {
		actor.role = "member";
	});
	it("classifies every router procedure and nothing else", () => {
		const paths: Array<string> = [];
		expect(
			walkProcedureContractsSync(apiRouter, (_contract, path) => {
				paths.push(path.join("/"));
			})
		).toEqual([]);
		expect(paths.toSorted()).toEqual(Object.keys(levels).toSorted());
	});
	it.each(pathsAt("write", "delete"))("rejects member call to %s before input parsing", async (path) => {
		expect(await call(path)).toBe(403);
	});
	it.each(pathsAt("delete"))("rejects admin call to %s", async (path) => {
		actor.role = "admin";
		expect(await call(path)).toBe(403);
	});
	it("lets an admin past a write guard", async () => {
		actor.role = "admin";
		expect(await call("domains/quote")).toBe(400);
	});
	it("lets an owner past a delete guard", async () => {
		actor.role = "owner";
		expect(await call("domains/transferCode")).toBe(400);
	});
});

describe("session organization role reuse", () => {
	const roleProbe = authedWithOrganization.handler(({ context }) => context.organizationRole);

	it("reuses a readable session role without querying membership", async () => {
		mocks.resolveSession.mockResolvedValue({
			organizationRole: "owner",
			session: { activeOrganizationId: "org-1" },
			user: { id: "user-1" },
		});
		await expect(callProcedure(roleProbe, undefined, { context: {} })).resolves.toBe("owner");
		expect(mocks.requireOrganizationPermission).not.toHaveBeenCalled();
	});
	it("falls back to the membership query when the session role is null", async () => {
		actor.role = "";
		mocks.resolveSession.mockResolvedValue({
			organizationRole: null,
			session: { activeOrganizationId: "org-1" },
			user: { id: "user-1" },
		});
		await expect(callProcedure(roleProbe, undefined, { context: {} })).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.requireOrganizationPermission).toHaveBeenCalledOnce();
	});
	it("queries membership for sessions without a role", async () => {
		actor.role = "admin";
		await expect(callProcedure(roleProbe, undefined, { context: {} })).resolves.toBe("admin");
		expect(mocks.requireOrganizationPermission).toHaveBeenCalledOnce();
	});
	it("keeps enforcing stricter permissions on a reused role", async () => {
		mocks.resolveSession.mockResolvedValue({
			organizationRole: "member",
			session: { activeOrganizationId: "org-1" },
			user: { id: "user-1" },
		});
		const writeProbe = authedWithOrganization.use(organizationPermission("write")).handler(() => "ok");
		await expect(callProcedure(writeProbe, undefined, { context: {} })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});
	it("rejects sessions without an active organization before any role query", async () => {
		mocks.resolveSession.mockResolvedValue({ session: { activeOrganizationId: null }, user: { id: "user-1" } });
		await expect(callProcedure(roleProbe, undefined, { context: {} })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(mocks.requireOrganizationPermission).not.toHaveBeenCalled();
	});
});
