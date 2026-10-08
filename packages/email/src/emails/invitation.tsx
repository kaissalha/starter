import * as React from "react";

import { Button, Section, Text } from "react-email";

import { EmailLayout } from "../components/email-layout";
import { getI18n } from "../locales";

type Props = {
	inviteLink?: string;
	inviterEmail?: string;
	inviterName?: string;
	locale?: string;
	organizationName?: string;
	recipientEmail?: string;
	role?: string;
};

export const InvitationEmail = ({
	inviteLink = "https://example.com/accept-invitation/invitation-id",
	inviterEmail = "jane@example.com",
	inviterName = "Jane Doe",
	locale = "en",
	organizationName = "Acme",
	recipientEmail = "you@example.com",
	role = "member",
}: Props) => {
	const { t } = getI18n({ locale });
	const signatureLines = t("invitation.signature").split(/<br\s*\/?>/);

	const displayInviter = inviterName?.trim().length ? inviterName : inviterEmail;
	const roleLabel = role === "admin" || role === "member" ? t(`invitation.roles.${role}`) : role;

	return (
		<EmailLayout
			locale={locale}
			preview={t("invitation.preview", { organizationName })}
			title={t("invitation.title", { organizationName })}
		>
			<br />

			<span className='font-medium'>{t("invitation.greeting")}</span>
			<Text className='text-neutral-950'>
				{t("invitation.intro", {
					inviter: displayInviter,
					organizationName,
					role: roleLabel,
				})}
				<br />
				<br />
				{t("invitation.description", { recipientEmail })}
			</Text>

			<Section className='my-6 text-center'>
				<Button
					className='rounded-lg bg-neutral-950 px-6 py-3 text-center text-sm font-medium text-white'
					href={inviteLink}
				>
					{t("invitation.cta")}
				</Button>
			</Section>

			<Text className='text-sm text-gray-500'>
				{t("invitation.fallback")}
				<br />
				<a className='break-all text-neutral-950 underline' dir='ltr' href={inviteLink}>
					{inviteLink}
				</a>
			</Text>

			<Text className='text-sm text-gray-500'>{t("invitation.not_you")}</Text>

			<br />

			<Text className='text-gray-500'>
				{signatureLines.map((line, index) => (
					<React.Fragment key={line}>
						{index > 0 ? <br /> : null}
						{line}
					</React.Fragment>
				))}
			</Text>

			<br />
			<br />
		</EmailLayout>
	);
};

export default InvitationEmail;
