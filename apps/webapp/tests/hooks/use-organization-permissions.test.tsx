import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	error: vi.fn<() => Error | null>(() => null),
	session: {
		data: { organizationRole: "owner", session: { activeOrganizationId: "org-a" }, user: { id: "user-a" } },
		isPending: false,
		isRefetching: false,
	},
	signedOut: false,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({
			...state.session,
			data: state.signedOut ? null : state.session.data,
			error: state.error(),
		}),
	},
}));

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";

describe("active organization permissions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		state.error.mockReturnValue(null);
		state.session.data = {
			organizationRole: "owner",
			session: { activeOrganizationId: "org-a" },
			user: { id: "user-a" },
		};
		state.session.isPending = false;
		state.session.isRefetching = false;
		state.signedOut = false;
	});
	it.each([
		["owner", true, true, true],
		["admin", true, true, false],
		["member", true, false, false],
		["unexpected", false, false, false],
		["owner,member", false, false, false],
		["admin,member", false, false, false],
	])("derives %s permissions", (role, canRead, canWrite, canDelete) => {
		state.session.data.organizationRole = role;
		const { result } = renderHook(useOrganizationPermissions);
		expect(result.current.can("invitation.cancel")).toBe(canDelete);
		expect(result.current.can("workspace.delete")).toBe(canDelete);
		expect(result.current.can("invitation.create")).toBe(canWrite);
		expect(result.current.can("member.update")).toBe(canWrite);
		expect(result.current.can("workspace.read")).toBe(canRead);
		expect(result.current.can("member.delete")).toBe(canDelete);
		expect(result.current.can("organization.update")).toBe(canWrite);
		expect(result.current.can("workspace.write")).toBe(canWrite);
	});
	it("fails closed on initial loading and retains verified permissions during background refresh", () => {
		state.session.isPending = true;
		const { rerender, result } = renderHook(useOrganizationPermissions);
		expect(result.current.can("workspace.write")).toBe(false);
		state.session.isPending = false;
		state.session.isRefetching = true;
		rerender();
		expect(result.current.can("workspace.read")).toBe(true);
		expect(result.current.can("invitation.create")).toBe(true);
		expect(result.current.can("workspace.delete")).toBe(true);
		expect(result.current.can("workspace.write")).toBe(true);
		expect(result.current).toMatchObject({ isLoading: false, isRefreshing: true, role: "owner" });
	});
	it("adopts organization and role changes together from the session", () => {
		const { rerender, result } = renderHook(useOrganizationPermissions);
		expect(result.current.can("workspace.delete")).toBe(true);
		state.session.data = {
			organizationRole: "member",
			session: { activeOrganizationId: "org-b" },
			user: { id: "user-b" },
		};
		rerender();
		expect(result.current.can("workspace.read")).toBe(true);
		expect(result.current.can("workspace.write")).toBe(false);
		expect(result.current).toMatchObject({ organizationId: "org-b", userId: "user-b" });
		state.session.data.session.activeOrganizationId = "";
		rerender();
		expect(result.current.can("workspace.read")).toBe(false);
	});
	it("reacts to demotion and keeps cached permissions through a session refetch error", () => {
		const { rerender, result } = renderHook(useOrganizationPermissions);
		state.session.data.organizationRole = "admin";
		rerender();
		expect(result.current.can("member.update")).toBe(true);
		expect(result.current.can("member.delete")).toBe(false);
		state.error.mockReturnValue(new Error("Session unavailable"));
		rerender();
		expect(result.current.can("member.update")).toBe(true);
		expect(result.current.can("workspace.read")).toBe(true);
	});
	it("fails closed when the session has no data", () => {
		const { rerender, result } = renderHook(useOrganizationPermissions);
		state.signedOut = true;
		rerender();
		expect(result.current.can("workspace.read")).toBe(false);
		expect(result.current.role).toBeNull();
	});
});
