import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	hydrateSession: vi.fn(),
	useSession: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		hydrateSession: mocks.hydrateSession,
		useSession: mocks.useSession,
	},
}));

import { AuthSessionContext, useAuthSession, type AuthSession } from "@/components/auth/auth-session-context";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";

const initialSession: AuthSession = {
	organizationRole: "owner",
	session: {
		activeOrganizationId: "org-a",
		createdAt: new Date(),
		expiresAt: new Date(Date.now() + 60_000),
		id: "session-a",
		ipAddress: null,
		token: "test-token",
		updatedAt: new Date(),
		userAgent: null,
		userId: "user-a",
	},
	user: {
		createdAt: new Date(),
		email: "test@example.com",
		emailVerified: true,
		id: "user-a",
		image: null,
		name: "Test",
		updatedAt: new Date(),
	},
};

describe("AuthSessionContext", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("hydrates the Better Auth store and treats a server-confirmed signed-out session as settled", () => {
		mocks.useSession.mockReturnValue({
			data: null,
			error: null,
			isPending: true,
			isRefetching: false,
			refetch: vi.fn(),
		});

		const { result } = renderHook(() => useAuthSession(), {
			wrapper: ({ children }) => <AuthSessionContext initialSession={null}>{children}</AuthSessionContext>,
		});

		expect(mocks.hydrateSession).toHaveBeenCalledWith(null);
		expect(result.current.data).toBeNull();
		expect(result.current.isPending).toBe(false);
	});
	it("provides permissions on the first render before client fetching", () => {
		mocks.useSession.mockReturnValue({ data: null, error: null, isPending: true, isRefetching: false });

		const { result } = renderHook(useOrganizationPermissions, {
			wrapper: ({ children }) => (
				<AuthSessionContext initialSession={initialSession}>{children}</AuthSessionContext>
			),
		});

		expect(mocks.hydrateSession.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.useSession.mock.invocationCallOrder[0]
		);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.can("invitation.create")).toBe(true);
	});
	it("does not restore the server session after sign-out or a failed refresh", () => {
		mocks.useSession.mockReturnValue({ data: null, error: null, isPending: false, isRefetching: false });

		const { rerender, result } = renderHook(useOrganizationPermissions, {
			wrapper: ({ children }) => (
				<AuthSessionContext initialSession={initialSession}>{children}</AuthSessionContext>
			),
		});

		expect(result.current.can("workspace.read")).toBe(false);
		mocks.useSession.mockReturnValue({
			data: null,
			error: new Error("Session unavailable"),
			isPending: false,
			isRefetching: false,
		});
		rerender();
		expect(result.current.can("workspace.read")).toBe(false);
	});
	it("preserves pending state outside a server session provider", () => {
		mocks.useSession.mockReturnValue({ data: null, error: null, isPending: true, isRefetching: false });
		const { result } = renderHook(useAuthSession);
		expect(result.current.isPending).toBe(true);
	});
});
