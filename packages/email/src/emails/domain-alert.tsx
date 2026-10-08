import { Button, Section, Text } from "react-email";

import { EmailLayout } from "../components/email-layout";
import { NotificationSettingsNote } from "../components/notification-settings-note";
import { getI18n } from "../locales";

type Props = {
	days?: number;
	domain?: string;
	kind?: "expiring" | "failed";
	locale?: string;
	manageLink?: string;
	settingsLink?: string;
};

export const DomainAlertEmail = ({
	days = 14,
	domain = "example.com",
	kind = "expiring",
	locale = "en",
	manageLink = "https://example.com/dashboard/website?websiteSettings=domains",
	settingsLink = "https://example.com/dashboard?settings=notifications",
}: Props) => {
	const { t } = getI18n({ locale });

	const copy =
		kind === "expiring"
			? {
					body: t("domainAlert.expiring.body", { days, domain }),
					preview: t("domainAlert.expiring.preview", { domain }),
					title: t("domainAlert.expiring.title", { domain }),
				}
			: {
					body: t("domainAlert.failed.body", { domain }),
					preview: t("domainAlert.failed.preview", { domain }),
					title: t("domainAlert.failed.title", { domain }),
				};

	return (
		<EmailLayout locale={locale} preview={copy.preview} title={copy.title}>
			<Text className='text-neutral-950'>{copy.body}</Text>

			<Section className='my-6 text-center'>
				<Button
					className='rounded-lg bg-neutral-950 px-6 py-3 text-center text-sm font-medium text-white'
					href={manageLink}
				>
					{t("domainAlert.cta")}
				</Button>
			</Section>

			<NotificationSettingsNote locale={locale} settingsLink={settingsLink} />
		</EmailLayout>
	);
};

export default DomainAlertEmail;
