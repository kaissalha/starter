import * as React from "react";

import { Text, View } from "@react-pdf/renderer";

import { getI18n } from "../locales";
import { baseStyles } from "./styles";

type FooterProps = {
	companyName?: string;
	locale?: string;
	pageNumber?: boolean;
	year: number;
};

export const Footer = ({ companyName = "Your Company", locale = "en", pageNumber = true, year }: FooterProps) => {
	const { t } = getI18n({ locale });

	return (
		<View fixed style={baseStyles.footer}>
			<Text>{t("components.footer.copyright", { companyName, year })}</Text>
			{pageNumber && (
				<Text
					render={({ pageNumber, totalPages }) => t("components.footer.page", { pageNumber, totalPages })}
				/>
			)}
		</View>
	);
};
