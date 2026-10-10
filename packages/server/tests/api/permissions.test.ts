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

describe("organization RPC permissions", () => {
	beforeEach(() => {
		actor.role = "member";
	});
	it("lets an admin past the permission gate for library/generateLogo", async () => {
		actor.role = "admin";
		expect(await call("library/generateLogo")).not.toBe(403);
	});
	it("rejects reads when the stored membership is no longer available", async () => {
		actor.role = "";
		expect(await call("library/list")).toBe(403);
	});
});

type GuardLevel = "delete" | "read" | "write";

const levels = {
	"chats/cancelStream": "write",
	"chats/list": "read",
	"chats/messages": "read",
	"documents/create": "write",
	"documents/delete": "delete",
	"documents/get": "read",
	"library/generateLogo": "write",
	"library/list": "read",
	"linkPreviews/get": "read",
	"media/delete": "delete",
	"media/list": "read",
	"notifications/archive": "read",
	"notifications/archiveAll": "read",
	"notifications/counts": "read",
	"notifications/list": "read",
	"notifications/markRead": "read",
	"notifications/markSeen": "read",
	"notificationSettings/getAll": "read",
	"notificationSettings/update": "read",
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
		expect(await call("documents/create")).toBe(400);
	});
	it("lets an owner past a delete guard", async () => {
		actor.role = "owner";
		expect(await call("media/delete")).toBe(400);
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
