import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	clearApiCache: vi.fn(),
	setActive: vi.fn(),
	signOut: vi.fn(),
}));

vi.mock("better-auth/client/plugins", () => ({
	customSessionClient: vi.fn(() => ({ id: "customSessionClient" })),
	emailOTPClient: vi.fn(() => ({ id: "emailOTPClient" })),
	lastLoginMethodClient: vi.fn(() => ({ id: "lastLoginMethodClient" })),
	organizationClient: vi.fn(() => ({ id: "organizationClient" })),
}));

vi.mock("@better-auth/i18n/client", () => ({
	i18nClient: vi.fn(() => ({ id: "i18nClient" })),
}));

vi.mock("better-auth/react", () => ({
	createAuthClient: vi.fn(() => ({
		organization: { setActive: mocks.setActive },
		signOut: mocks.signOut,
	})),
}));

vi.mock("@starter/utils", () => ({
	getBaseURL: () => new URL("https://example.com"),
}));

vi.mock("@/lib/api-query-client", () => ({ clearApiCache: mocks.clearApiCache }));

import { setActiveOrganization, signOut } from "@/lib/auth-client";

describe("auth cache lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("clears API queries after a successful organization switch", async () => {
		mocks.setActive.mockResolvedValue({ data: { id: "organization-2" }, error: null });

		await expect(setActiveOrganization({ organizationId: "organization-2" })).resolves.toEqual({
			data: { id: "organization-2" },
			error: null,
		});

		expect(mocks.clearApiCache).toHaveBeenCalledOnce();
	});

	it("keeps the current cache when an organization switch fails", async () => {
		mocks.setActive.mockResolvedValue({ data: null, error: { message: "Not allowed" } });

		await setActiveOrganization({ organizationId: "organization-2" });

		expect(mocks.clearApiCache).not.toHaveBeenCalled();
	});

	it("clears API queries after successful and failed sign-out attempts", async () => {
		mocks.signOut.mockResolvedValueOnce({ data: true }).mockRejectedValueOnce(new Error("Network unavailable"));

		await signOut();
		await expect(signOut()).rejects.toThrow("Network unavailable");

		expect(mocks.clearApiCache).toHaveBeenCalledTimes(2);
	});
});
