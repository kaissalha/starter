"use client";

import { useEffect, type ReactNode } from "react";

import { NextIntlClientProvider, useLocale, useMessages } from "next-intl";

export const DashboardThemeScope = () => {
	useEffect(
		() => () => {
			document.documentElement.classList.remove("light", "dark");
			document.documentElement.style.colorScheme = "";
		},
		[]
	);

	return null;
};

export const DashboardTimeZoneProvider = ({ children, timeZone }: { children: ReactNode; timeZone: string }) => {
	const locale = useLocale();
	const messages = useMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
			{children}
		</NextIntlClientProvider>
	);
};
