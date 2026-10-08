import { Section, Text } from "react-email";

import { getI18n } from "../locales";

type Props = {
	locale?: string;
};

export const Footer = ({ locale = "en" }: Props) => {
	const { t } = getI18n({ locale });

	return (
		<Section className='text-center'>
			<Text className='my-2 text-base font-semibold leading-6 text-gray-500'>
				{t("components.footer.company")}
			</Text>
		</Section>
	);
};
