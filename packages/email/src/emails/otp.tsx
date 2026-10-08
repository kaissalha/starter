import { Text } from "react-email";

import { EmailLayout } from "../components/email-layout";
import { getI18n } from "../locales";

type Props = {
	expiresInMinutes?: number;
	locale?: string;
	otp?: string;
};

const renderLineBreak = () => <br />;

export const OTPEmail = ({ expiresInMinutes = 5, locale = "en", otp = "123456" }: Props) => {
	const { markup, t } = getI18n({ locale });

	return (
		<EmailLayout locale={locale} preview={t("otp.intro")} title={t("otp.title")}>
			<br />

			<span className='font-medium'>{t("otp.greeting")}</span>
			<Text className='text-neutral-950'>
				{t("otp.intro")}
				<br />
				<br />
				{t("otp.description")}
			</Text>

			<div
				style={{
					background: "#f4f4f4",
					borderRadius: "8px",
					margin: "24px 0",
					padding: "24px",
					textAlign: "center",
				}}
			>
				<Text className='mb-2 text-sm font-medium text-gray-500'>{t("otp.code_label")}</Text>
				<Text className='m-0 text-3xl font-bold tracking-wide text-neutral-950'>{otp}</Text>
			</div>

			<Text className='text-sm text-gray-500'>
				{t("otp.expires", { minutes: expiresInMinutes })}
				<br />
				<br />
				{t("otp.not_requested")}
			</Text>

			<br />

			<Text className='text-gray-500'>{markup("otp.signature", { br: renderLineBreak })}</Text>

			<br />
			<br />
		</EmailLayout>
	);
};

export default OTPEmail;
