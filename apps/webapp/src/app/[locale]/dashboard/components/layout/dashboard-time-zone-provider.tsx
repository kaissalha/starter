"use client";

import type { ReactNode } from "react";

import { NextIntlClientProvider, useLocale, useMessages } from "next-intl";

export const DashboardTimeZoneProvider = ({ children, timeZone }: { children: ReactNode; timeZone: string }) => {
	const locale = useLocale();
	const messages = useMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
			{children}
		</NextIntlClientProvider>
	);
};
