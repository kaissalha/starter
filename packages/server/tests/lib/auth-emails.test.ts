import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@starter/email", async () => (await import("../helpers/email")).emailPackageMock);

vi.mock("react-email", () => ({ render: vi.fn().mockResolvedValue("<html />") }));

vi.mock("../../src/lib/resend", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { InvitationEmail, OTPEmail } from "@starter/email";

import { OTP_EXPIRES_IN_SECONDS, sendOrganizationInvitationEmail, sendOTPEmail } from "../../src/lib/auth-emails";
import { sendEmail } from "../../src/lib/resend";

const invitation = {
	email: "invitee@example.com",
	invitationId: "invitation-1",
	inviterEmail: "jane@example.com",
	inviterName: "Jane Doe",
	organizationName: "Acme Co",
	role: "admin",
};

describe("auth emails", () => {
	beforeEach(() => vi.clearAllMocks());

	it.each([
		["https://app.example.com/ar/login", "ar"],
		["https://app.example.com/ar", "ar"],
		["https://app.example.com/login", "en"],
		["https://app.example.com/en/dashboard", "en"],
		["https://app.example.com/fr/login", "en"],
		["not a url", "en"],
	])("renders the sign-in code for %s in %s", async (referer, expected) => {
		await sendOTPEmail({ email: "person@example.com", headers: new Headers({ referer }), otp: "123456" });
		expect(OTPEmail).toHaveBeenCalledWith({
			expiresInMinutes: OTP_EXPIRES_IN_SECONDS / 60,
			locale: expected,
			otp: "123456",
		});
	});

	it("renders the sign-in code in English without request headers", async () => {
		await sendOTPEmail({ email: "person@example.com", headers: undefined, otp: "123456" });
		expect(OTPEmail).toHaveBeenCalledWith(expect.objectContaining({ locale: "en" }));
	});

	it("sends the Arabic sign-in code with a localized subject", async () => {
		await sendOTPEmail({
			email: "person@example.com",
			headers: new Headers({ referer: "https://app.example.com/ar/login" }),
			otp: "123456",
		});
		expect(sendEmail).toHaveBeenCalledWith({
			flow: "email-otp",
			html: "<html />",
			subject: "ar:otp.title:",
			to: "person@example.com",
		});
	});

	it("links Arabic invitations to the Arabic acceptance page", async () => {
		await sendOrganizationInvitationEmail({
			...invitation,
			headers: new Headers({ referer: "https://app.example.com/ar/dashboard" }),
		});
		expect(InvitationEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				inviteLink: expect.stringMatching(/^https?:\/\/[^/]+\/ar\/accept-invitation\/invitation-1$/),
				locale: "ar",
				recipientEmail: "invitee@example.com",
				role: "admin",
			})
		);
		expect(sendEmail).toHaveBeenCalledWith({
			flow: "organization-invitation",
			html: "<html />",
			subject: "ar:invitation.title:Acme Co",
			to: "invitee@example.com",
		});
	});

	it("links invitations without a referer to the unprefixed acceptance page", async () => {
		await sendOrganizationInvitationEmail({ ...invitation, headers: undefined });
		expect(InvitationEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				inviteLink: expect.stringMatching(/^https?:\/\/[^/]+\/accept-invitation\/invitation-1$/),
				locale: "en",
			})
		);
	});
});
