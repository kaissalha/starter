/**
 * @vitest-environment node
 */
import { beforeEach, expect, it, vi } from "vitest";

import { requireDashboardSession } from "@/lib/server/dashboard-session";

import { mockRedirect } from "../../mocks/routing";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));

vi.mock("@/lib/server/auth", () => ({ getServerSession }));

beforeEach(() => {
	mockRedirect.mockImplementation(() => {
		throw new Error("redirect");
	});
});

it.each([
	{ href: "/login", session: null },
	{ href: "/onboarding", session: { session: { activeOrganizationId: null }, user: { id: "user-1" } } },
])("redirects to $href before rendering dashboard pages", async ({ href, session }) => {
	getServerSession.mockResolvedValue(session);
	await expect(requireDashboardSession()).rejects.toThrow("redirect");
	expect(mockRedirect).toHaveBeenCalledWith({ href, locale: "en" });
});

it("returns the session for members of an active organization", async () => {
	const session = { session: { activeOrganizationId: "org-1" }, user: { id: "user-1" } };
	getServerSession.mockResolvedValue(session);
	await expect(requireDashboardSession()).resolves.toBe(session);
	expect(mockRedirect).not.toHaveBeenCalled();
});
