import { render } from "react-email";

import { getI18n, InvitationEmail, isSupportedLocale, OTPEmail } from "@starter/email";
import { getBaseURL } from "@starter/utils";

import { sendEmail } from "../lib/resend";

export const OTP_EXPIRES_IN_SECONDS = 5 * 60;

const defaultLocale = "en";

const getRequestEmailLocale = (headers: HeadersInit | undefined) => {
	const referer = new Headers(headers).get("referer");

	if (!referer || !URL.canParse(referer)) {
		return defaultLocale;
	}

	const [, firstSegment] = new URL(referer).pathname.split("/");

	return isSupportedLocale(firstSegment) ? firstSegment : defaultLocale;
};

export const sendOTPEmail = async ({
	email,
	headers,
	otp,
}: {
	email: string;
	headers: HeadersInit | undefined;
	otp: string;
}) => {
	const locale = getRequestEmailLocale(headers);
	const html = await render(OTPEmail({ expiresInMinutes: OTP_EXPIRES_IN_SECONDS / 60, locale, otp }));

	await sendEmail({ flow: "email-otp", html, subject: getI18n({ locale }).t("otp.title"), to: email });
};

export const sendOrganizationInvitationEmail = async ({
	email,
	headers,
	invitationId,
	inviterEmail,
	inviterName,
	organizationName,
	role,
}: {
	email: string;
	headers: HeadersInit | undefined;
	invitationId: string;
	inviterEmail: string;
	inviterName: string;
	organizationName: string;
	role: string;
}) => {
	const locale = getRequestEmailLocale(headers);
	const localePrefix = locale === defaultLocale ? "" : `/${locale}`;
	const inviteLink = new URL(`${localePrefix}/accept-invitation/${invitationId}`, getBaseURL()).toString();

	const html = await render(
		InvitationEmail({
			inviteLink,
			inviterEmail,
			inviterName,
			locale,
			organizationName,
			recipientEmail: email,
			role,
		})
	);

	await sendEmail({
		flow: "organization-invitation",
		html,
		subject: getI18n({ locale }).t("invitation.title", { organizationName }),
		to: email,
	});
};
