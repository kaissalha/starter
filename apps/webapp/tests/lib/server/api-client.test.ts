/**
 * @vitest-environment node
 */
import { ORPCError } from "@orpc/client";
import { os } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireDashboardSession: vi.fn() }));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/dashboard-session", () => ({ requireDashboardSession: mocks.requireDashboardSession }));

vi.mock("@starter/server/api", () => ({
	apiRouter: {
		linkPages: {
			get: os.handler(() => {
				throw new ORPCError("UNAUTHORIZED");
			}),
		},
		websites: {
			agentChat: os.handler(() => {
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}),
			get: os.handler(() => {
				throw new ORPCError("BAD_REQUEST", { message: "Organization not found" });
			}),
		},
	},
}));

const { serverClient } = await import("@/lib/server/api-client");

beforeEach(() => {
	mocks.requireDashboardSession.mockReset();
});

it.each([
	["UNAUTHORIZED", () => serverClient.linkPages.get()],
	["BAD_REQUEST", () => serverClient.websites.get()],
])("redirects through the dashboard guard on %s", async (_code, call) => {
	mocks.requireDashboardSession.mockRejectedValue(new Error("redirect"));
	await expect(call()).rejects.toThrow("redirect");
	expect(mocks.requireDashboardSession).toHaveBeenCalledOnce();
});

it("rethrows the original error when the session and organization are valid", async () => {
	mocks.requireDashboardSession.mockResolvedValue({});
	await expect(serverClient.websites.get()).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("leaves other failures untouched", async () => {
	await expect(serverClient.websites.agentChat()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
	expect(mocks.requireDashboardSession).not.toHaveBeenCalled();
});
