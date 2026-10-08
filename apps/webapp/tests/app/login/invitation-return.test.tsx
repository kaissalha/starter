import { BetterFetchError } from "@better-fetch/fetch";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OTPVerificationForm } from "@/app/[locale]/(auth)/login/components/otp-verification-form";
import { LoginPageClient } from "@/app/[locale]/(auth)/login/login-page-client";
import LoginPage from "@/app/[locale]/(auth)/login/page";
import { useAuthLoginFlowStore } from "@/hooks/auth-login-flow-store";

import { mockUseSearchParams } from "../../mocks/routing";

const mocks = vi.hoisted(() => ({
	assign: vi.fn(),
	emailOtp: vi.fn(),
	error: vi.fn(),
	followRedirect: vi.fn(),
	sendOtp: vi.fn(),
	social: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		emailOtp: { sendVerificationOtp: mocks.sendOtp },
		getLastUsedLoginMethod: () => null,
		signIn: { emailOtp: mocks.emailOtp, social: mocks.social },
	},
}));

vi.mock("@/utils/follow-auth-redirect", () => ({ followAuthRedirect: mocks.followRedirect }));

vi.mock("@starter/ui/components/toaster", () => ({ toast: { error: mocks.error } }));

vi.mock("@/app/[locale]/(auth)/login/components/login-video-background", () => ({ LoginVideoBackground: () => null }));

const renderWithIntl = (ui: React.ReactNode) =>
	render(
		<NextIntlClientProvider locale='en' messages={{}} timeZone='UTC'>
			{ui}
		</NextIntlClientProvider>
	);

const invitationPath = "/ar/accept-invitation/invite-1";

const submitOtp = async () => {
	fireEvent.change(screen.getByRole("textbox", { name: "fields.otp.label" }), { target: { value: "123456" } });
	await userEvent.click(screen.getByRole("button", { name: "verify" }));
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.followRedirect.mockReturnValue(false);
	mocks.emailOtp.mockResolvedValue({ data: { token: "test-token" }, error: null });
	mocks.sendOtp.mockResolvedValue({ success: true });
	mocks.social.mockResolvedValue({ redirect: true, url: "https://accounts.google.com" });
	const { result } = renderHook(() => useAuthLoginFlowStore((state) => state));
	act(() => result.current.reset());
	vi.stubGlobal("window", Object.create(window, { location: { value: { assign: mocks.assign } } }));
	mockUseSearchParams.mockReturnValue(new URLSearchParams({ redirect_url: invitationPath }));
});

afterEach(() => vi.unstubAllGlobals());

describe("invitation login return", () => {
	it("recovers a rejected code request and continues with the invited email", async () => {
		mocks.sendOtp.mockRejectedValueOnce(new BetterFetchError(429, "Too Many Requests", { message: "Try again" }));
		renderWithIntl(<LoginPageClient />);
		await userEvent.click(screen.getByRole("button", { name: /emailCta/ }));
		await userEvent.type(await screen.findByRole("textbox", { name: "fields.email.label" }), "invited@example.com");
		await userEvent.click(screen.getByRole("button", { name: "emailContinue" }));
		expect(mocks.error).toHaveBeenCalledWith("messages.emailFailed");
		await userEvent.click(screen.getByRole("button", { name: "emailContinue" }));
		expect(mocks.sendOtp).toHaveBeenCalledWith({
			email: "invited@example.com",
			fetchOptions: { throw: true },
			type: "sign-in",
		});
		await waitFor(() => expect(screen.getByRole("textbox", { name: "fields.otp.label" })).toBeVisible());
	});

	it("shows a login loading shell while the return URL is unavailable", () => {
		const pending = Promise.withResolvers<never>();
		mockUseSearchParams.mockImplementation(() => {
			throw pending.promise;
		});
		renderWithIntl(<LoginPage />);
		expect(screen.getByRole("status")).toBeVisible();
		expect(screen.getByRole("status")).toHaveTextContent("loading");
	});

	it("returns through email OTP using the safe invitation target read from login", async () => {
		const { result } = renderHook(() => useAuthLoginFlowStore((state) => state));
		act(() => result.current.beginOtp({ email: "invited@example.com" }));
		renderWithIntl(<LoginPageClient />);
		expect(screen.getByText("otpRequestedRelative")).toBeVisible();
		expect(screen.getByRole("button", { name: "current" })).toBeVisible();
		await submitOtp();
		expect(mocks.emailOtp).toHaveBeenCalledWith({ email: "invited@example.com", otp: "123456" });
		expect(mocks.assign).toHaveBeenCalledWith(invitationPath);
	});

	it("preserves the invitation for existing and new Google accounts", async () => {
		renderWithIntl(<LoginPageClient />);
		await userEvent.click(screen.getByRole("button", { name: /withGoogle/ }));
		expect(mocks.social).toHaveBeenCalledWith({
			callbackURL: invitationPath,
			fetchOptions: { throw: true },
			newUserCallbackURL: invitationPath,
			provider: "google",
		});
	});

	it("ignores an external redirect for Google login", async () => {
		mockUseSearchParams.mockReturnValue(new URLSearchParams({ redirect_url: "//evil.example" }));
		renderWithIntl(<LoginPageClient />);
		await userEvent.click(screen.getByRole("button", { name: /withGoogle/ }));
		expect(mocks.social).toHaveBeenCalledWith({
			callbackURL: "/dashboard",
			fetchOptions: { throw: true },
			newUserCallbackURL: "/dashboard",
			provider: "google",
		});
	});

	it("prioritizes Better Auth's OAuth continuation over the invitation return", async () => {
		mocks.followRedirect.mockReturnValue(true);
		renderWithIntl(
			<OTPVerificationForm email='invited@example.com' otpSentAt={null} redirectUrl={invitationPath} />
		);
		await submitOtp();
		expect(mocks.followRedirect).toHaveBeenCalledWith({ token: "test-token" });
		expect(mocks.assign).not.toHaveBeenCalled();
	});

	it("handles an OTP network rejection and allows another attempt", async () => {
		mocks.emailOtp.mockRejectedValueOnce(new Error("Offline"));
		renderWithIntl(
			<OTPVerificationForm email='invited@example.com' otpSentAt={null} redirectUrl={invitationPath} />
		);
		await submitOtp();
		expect(screen.getByRole("alert")).toHaveTextContent("messages.somethingWentWrong");
		expect(mocks.assign).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "verify" })).toBeEnabled();
	});

	it("handles Google login rejection without leaving the button pending", async () => {
		mocks.social.mockRejectedValueOnce(new Error("Offline"));
		renderWithIntl(<LoginPageClient />);
		await userEvent.click(screen.getByRole("button", { name: /withGoogle/ }));
		expect(mocks.error).toHaveBeenCalledWith("messages.somethingWentWrong");
		expect(screen.getByRole("button", { name: /withGoogle/ })).toBeEnabled();
	});
});
