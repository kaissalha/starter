import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	authHandler: vi.fn<(request: Request) => Promise<Response>>(async () => new Response("ok")),
}));

vi.mock("@/utils/with-error-handler", () => ({
	withErrorHandler: (handler: (request: Request) => Promise<Response>) => handler,
}));

vi.mock("@starter/server/auth", () => ({
	auth: {
		handler: mocks.authHandler,
	},
}));

import { POST } from "@/app/api/auth/[...all]/route";

describe("auth route", () => {
	beforeEach(() => {
		mocks.authHandler.mockClear();
	});

	it.each(["introspect", "register", "revoke", "token"])(
		"removes ambient cookies from originless OAuth %s requests",
		async (endpoint) => {
			await POST(
				new Request(`https://starter.example/api/auth/oauth2/${endpoint}`, {
					headers: {
						cookie: "better-auth.session_token=session",
					},
					method: "POST",
				})
			);

			expect(mocks.authHandler.mock.calls[0]?.[0].headers.has("cookie")).toBe(false);
		}
	);

	it("keeps the body and remaining headers when stripping an ambient cookie", async () => {
		await POST(
			new Request("https://starter.example/api/auth/oauth2/token", {
				body: "grant_type=refresh_token&refresh_token=token",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					cookie: "better-auth.session_token=session",
				},
				method: "POST",
			})
		);

		const forwarded = mocks.authHandler.mock.calls[0]?.[0];
		expect(forwarded?.headers.has("cookie")).toBe(false);
		expect(forwarded?.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
		await expect(forwarded?.text()).resolves.toBe("grant_type=refresh_token&refresh_token=token");
	});

	it("preserves cookies for browser OAuth requests", async () => {
		await POST(
			new Request("https://starter.example/api/auth/oauth2/token", {
				headers: {
					cookie: "better-auth.session_token=session",
					origin: "https://starter.example",
				},
				method: "POST",
			})
		);

		expect(mocks.authHandler.mock.calls[0]?.[0].headers.get("cookie")).toBe("better-auth.session_token=session");
	});

	it("preserves cookies outside server-to-server OAuth endpoints", async () => {
		await POST(
			new Request("https://starter.example/api/auth/oauth2/consent", {
				headers: {
					cookie: "better-auth.session_token=session",
				},
				method: "POST",
			})
		);

		expect(mocks.authHandler.mock.calls[0]?.[0].headers.get("cookie")).toBe("better-auth.session_token=session");
	});
});
