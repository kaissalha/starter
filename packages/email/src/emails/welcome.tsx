import { Text } from "react-email";

import { EmailLayout } from "../components/email-layout";
import { getI18n } from "../locales";

type Props = {
	fullName?: string;
	locale?: string;
};

const renderLineBreak = () => <br />;

export const WelcomeEmail = ({ fullName = "Viktor Hofte", locale = "en" }: Props) => {
	const firstName = fullName.split(" ").at(0);
	const { markup, t } = getI18n({ locale });

	return (
		<EmailLayout locale={locale} preview={t("welcome.intro")} title={t("welcome.title")}>
			<br />

			<span className='font-medium'>{t("welcome.greeting", { firstName })}</span>
			<Text className='text-neutral-950'>
				{t("welcome.intro")}
				<br />
				<br />
				{t("welcome.description")}
				<br />
				<br />
				{t("welcome.support")}
			</Text>

			<br />

			<Text className='text-gray-500'>{markup("welcome.signature", { br: renderLineBreak })}</Text>

			<br />
			<br />
		</EmailLayout>
	);
};

export default WelcomeEmail;
