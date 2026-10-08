/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@starter/server/auth", () => ({
	auth: {
		api: {
			getSession,
		},
	},
}));

import { publicMiddleware } from "@/middlewares/public";

const createRequest = (url: string) => new NextRequest(url);

const createSession = ({ activeOrganizationId }: { activeOrganizationId?: string | null }) => ({
	session: {
		activeOrganizationId,
	},
});

describe("publicMiddleware", () => {
	beforeEach(() => {
		getSession.mockReset();
	});

	it("redirects signed-in users with an active organization to the dashboard", async () => {
		getSession.mockResolvedValue(createSession({ activeOrganizationId: "org_123" }));

		const response = await publicMiddleware(createRequest("https://example.com/en/login"));

		expect(response?.headers.get("location")).toBe("https://example.com/en/dashboard");
	});

	it("redirects signed-in users without an active organization to onboarding", async () => {
		getSession.mockResolvedValue(createSession({ activeOrganizationId: null }));

		const response = await publicMiddleware(createRequest("https://example.com/en/login"));

		expect(response?.headers.get("location")).toBe("https://example.com/en/onboarding");
	});

	it.each([null, "org_123"])(
		"returns directly to an invitation with active organization %s",
		async (activeOrganizationId) => {
			getSession.mockResolvedValue(createSession({ activeOrganizationId }));

			const response = await publicMiddleware(
				createRequest(
					"https://example.com/ar/login?redirect_url=%2Far%2Faccept-invitation%2Finvite-1%3Ffrom%3Demail"
				)
			);

			expect(response?.headers.get("location")).toBe(
				"https://example.com/ar/accept-invitation/invite-1?from=email"
			);
		}
	);

	it.each(["//evil.example", "/%5cevil.example", "/ar/login"])(
		"drops unsafe or looping redirect %s",
		async (target) => {
			getSession.mockResolvedValue(createSession({ activeOrganizationId: "org_123" }));
			const url = new URL("https://example.com/ar/login");
			url.searchParams.set("redirect_url", target);
			const response = await publicMiddleware(createRequest(url.toString()));
			expect(response?.headers.get("location")).toBe("https://example.com/ar/dashboard");
		}
	);

	it("allows unauthenticated users to continue to public pages", async () => {
		getSession.mockResolvedValue(null);

		const response = await publicMiddleware(createRequest("https://example.com/login"));

		expect(response).toBeUndefined();
	});

	it("resumes a signed OAuth authorization request for signed-in users", async () => {
		getSession.mockResolvedValue(createSession({ activeOrganizationId: "org_123" }));

		const response = await publicMiddleware(
			createRequest(
				"https://example.com/en/login?response_type=code&client_id=client_1&ba_param=client_id&sig=signature&redirect_url=%2Faccept-invitation%2Finvite-1"
			)
		);

		const location = new URL(response?.headers.get("location") ?? "");
		expect(location.pathname).toBe("/api/auth/oauth2/authorize");
		expect(location.searchParams.get("client_id")).toBe("client_1");
		expect(location.searchParams.get("sig")).toBe("signature");
	});

	it("keeps a signed OAuth request on the onboarding bounce until an organization exists", async () => {
		getSession.mockResolvedValue(createSession({ activeOrganizationId: null }));

		const response = await publicMiddleware(
			createRequest(
				"https://example.com/en/login?client_id=client_1&ba_param=client_id&sig=signature&redirect_url=%2Faccept-invitation%2Finvite-1"
			)
		);

		const location = new URL(response?.headers.get("location") ?? "");
		expect(location.pathname).toBe("/en/onboarding");
		expect(location.searchParams.get("sig")).toBe("signature");
	});
});
