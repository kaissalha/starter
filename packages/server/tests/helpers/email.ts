import { vi } from "vitest";

export const emailPackageMock = {
	getI18n: ({ locale }: { locale: string }) => ({
		t: (key: string, params?: { organizationName?: string }) =>
			`${locale}:${key}:${params?.organizationName ?? ""}`,
	}),
	InvitationEmail: vi.fn(),
	isSupportedLocale: (value: string | undefined) => value === "en" || value === "ar",
	OTPEmail: vi.fn(),
};
