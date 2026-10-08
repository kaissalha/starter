import { Button, Section, Text } from "react-email";

import { EmailLayout } from "../components/email-layout";
import { NotificationSettingsNote } from "../components/notification-settings-note";
import { getI18n } from "../locales";

type Props = {
	contactLink?: string;
	locale?: string;
	message?: string;
	senderEmail?: string;
	senderName?: string;
	senderPhone?: string | null;
	settingsLink?: string;
};

export const ContactMessageEmail = ({
	contactLink = "https://example.com/dashboard/contacts",
	locale = "en",
	message = "Hi, I'd like to book a table for Friday.",
	senderEmail = "ada@example.com",
	senderName = "Ada Lovelace",
	senderPhone = null,
	settingsLink = "https://example.com/dashboard?settings=notifications",
}: Props) => {
	const { t } = getI18n({ locale });

	return (
		<EmailLayout
			locale={locale}
			preview={t("contactMessage.preview", { name: senderName })}
			title={t("contactMessage.title")}
		>
			<Text className='text-neutral-950'>{t("contactMessage.intro", { name: senderName })}</Text>

			<Section className='my-4 rounded-lg bg-neutral-50 p-4'>
				{senderEmail ? (
					<Text className='m-0 text-sm text-gray-500'>
						{t("contactMessage.email_label")}: <span dir='auto'>{senderEmail}</span>
					</Text>
				) : null}
				{senderPhone ? (
					<Text className='m-0 text-sm text-gray-500'>
						{t("contactMessage.phone_label")}: <span dir='auto'>{senderPhone}</span>
					</Text>
				) : null}
				<Text className='m-0 text-sm text-gray-500'>{t("contactMessage.message_label")}</Text>
				<Text className='m-0 whitespace-pre-wrap text-neutral-950' dir='auto'>
					{message}
				</Text>
			</Section>

			<Section className='my-6 text-center'>
				<Button
					className='rounded-lg bg-neutral-950 px-6 py-3 text-center text-sm font-medium text-white'
					href={contactLink}
				>
					{t("contactMessage.cta")}
				</Button>
			</Section>

			<NotificationSettingsNote locale={locale} settingsLink={settingsLink} />
		</EmailLayout>
	);
};

export default ContactMessageEmail;
