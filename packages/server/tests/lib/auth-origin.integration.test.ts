import { afterAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { auth, MCP_RESOURCE, ORGANIZATION_ID_CLAIM } from "../../src/lib/auth";

vi.hoisted(() => {
	process.env.NEXT_PUBLIC_BASE_URL = "https://app.example.com";
	process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF = "master";
});

vi.mock("@starter/email", () => ({ InvitationEmail: vi.fn(), OTPEmail: vi.fn() }));

vi.mock("react-email", () => ({ render: vi.fn() }));

vi.mock("../../src/lib/resend", () => ({ resend: { emails: { send: vi.fn() } } }));

describe("auth on a configured production origin", () => {
	afterAll(() => {
		delete process.env.NEXT_PUBLIC_BASE_URL;
		delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;
	});

	it("derives the MCP resource and organization claim from the configured origin", () => {
		expect(MCP_RESOURCE).toBe("https://app.example.com/api/mcp");
		expect(ORGANIZATION_ID_CLAIM).toBe("https://app.example.com/claims/organization-id");
	});

	it("binds the base URL and trusted origins to the configured host with a host-only session cookie", async () => {
		const context = await auth.$context;

		expect(context.baseURL).toBe("https://app.example.com/api/auth");
		expect(context.isTrustedOrigin("https://app.example.com")).toBe(true);
		expect(context.isTrustedOrigin("https://old-host.vercel.app")).toBe(false);
		expect(context.authCookies.sessionToken.attributes.domain).toBeUndefined();
		expect(context.options.account?.encryptOAuthTokens).toBe(true);
		expect(context.authCookies.sessionToken.attributes.secure).toBe(true);
	});

	it("advertises OAuth endpoints on the configured origin", async () => {
		const response = await auth.handler(
			new Request("https://app.example.com/.well-known/oauth-authorization-server/api/auth")
		);

		expect(
			z.object({ registration_endpoint: z.string().url() }).parse(await response.json()).registration_endpoint
		).toBe("https://app.example.com/api/auth/oauth2/register");
	});

	it.each([
		["/email-otp/request-password-reset", false],
		["/forget-password/email-otp", false],
		["/email-otp/reset-password", false],
		["/email-otp/request-email-change", false],
		["/email-otp/change-email", false],
		["/expo-authorization-proxy", false],
		["/email-otp/send-verification-otp", true],
		["/sign-in/email-otp", true],
	])("routes %s only when it is part of the passwordless flow (%s)", async (path, routed) => {
		const response = await auth.handler(
			new Request(`https://app.example.com/api/auth${path}`, {
				body: "{}",
				headers: { "content-type": "application/json" },
				method: "POST",
			})
		);

		expect(response.status === 404).toBe(!routed);
		expect(response.status).toBeGreaterThanOrEqual(400);
	});
});
