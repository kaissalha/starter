import { Text } from "react-email";

import { getI18n } from "../locales";

export const NotificationSettingsNote = ({ locale, settingsLink }: { locale: string; settingsLink: string }) => {
	const { t } = getI18n({ locale });

	return (
		<Text className='text-sm text-gray-500'>
			{t("notificationSettings.reason")}{" "}
			<a className='text-neutral-950 underline' href={settingsLink}>
				{t("notificationSettings.link")}
			</a>
		</Text>
	);
};
