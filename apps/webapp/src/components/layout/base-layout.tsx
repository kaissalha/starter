import { Suspense } from "react";

import { Geist_Mono, Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { PostHogPageView } from "@posthog/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VercelToolbar } from "@vercel/toolbar/next";
import { EvlogProvider } from "evlog/next/client";
import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import type { Locale } from "@/i18n/routing";
import { ApiProvider } from "@/lib/api";
import { PostHogClientEffects } from "@/lib/posthog";
import { Toaster } from "@starter/ui/components/toaster";
import { getDirection } from "@starter/utils";

import "server-only";

import { ErrorToaster } from "../error-toaster";
import { BaseLayoutPostHogProvider } from "./base-layout-posthog-provider";

const openRunde = localFont({
	src: [
		{
			path: "../../../node_modules/@fontsource/open-runde/files/open-runde-latin-400-normal.woff2",
			weight: "400",
		},
		{
			path: "../../../node_modules/@fontsource/open-runde/files/open-runde-latin-500-normal.woff2",
			weight: "500",
		},
		{
			path: "../../../node_modules/@fontsource/open-runde/files/open-runde-latin-600-normal.woff2",
			weight: "600",
		},
		{
			path: "../../../node_modules/@fontsource/open-runde/files/open-runde-latin-700-normal.woff2",
			weight: "700",
		},
	],
	variable: "--font-sans",
});

const geistMono = Geist_Mono({
	preload: false,
	subsets: ["latin"],
	variable: "--font-mono",
});

const instrumentSerif = Instrument_Serif({
	style: ["normal", "italic"],
	subsets: ["latin"],
	variable: "--font-display",
	weight: "400",
});

const notoSansArabic = localFont({
	declarations: [{ prop: "size-adjust", value: "125%" }],
	preload: false,
	src: "../../../node_modules/@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2",
	variable: "--font-arabic",
	weight: "100 900",
});

type BaseLayoutProps = {
	children: React.ReactNode;
	loadingLabel: string;
	locale: Locale;
	messages: AbstractIntlMessages;
};

export const BaseLayout = ({ children, loadingLabel, locale, messages }: BaseLayoutProps) => {
	const dir = getDirection(locale);

	return (
		<html
			className={`notranslate ${openRunde.variable} ${geistMono.variable} ${instrumentSerif.variable} ${notoSansArabic.variable}`}
			data-scroll-behavior='smooth'
			dir={dir}
			lang={locale}
			suppressHydrationWarning
			translate='no'
		>
			<head>
				<meta content='telephone=no, date=no, address=no, email=no' name='format-detection' />
			</head>
			<body className='antialiased overflow-x-hidden max-w-dvw [&_svg.scale-110:dir(rtl)]:-scale-x-110'>
				{process.env.NODE_ENV === "development" &&
					(process.env.REACT_SCAN === "1" || process.env.REACT_SCAN === "true") && (
						<Script src='//unpkg.com/react-scan@0.5.7/dist/auto.global.js' strategy='afterInteractive' />
					)}
				<BaseLayoutPostHogProvider>
					<EvlogProvider console={process.env.NODE_ENV === "development"} service='webapp'>
						<PostHogClientEffects />
						<PostHogPageView />

						<NextIntlClientProvider locale={locale} messages={messages}>
							<NuqsAdapter>
								<ApiProvider>
									<DirectionProvider direction={dir}>
										<div className='flex min-h-dvh flex-col'>
											<Suspense
												fallback={
													<span className='sr-only' role='status'>
														{loadingLabel}
													</span>
												}
											>
												{children}
											</Suspense>
											<Toaster position='bottom-right' />
											<Suspense
												fallback={
													<span className='sr-only' role='status'>
														{loadingLabel}
													</span>
												}
											>
												<ErrorToaster />
											</Suspense>
										</div>
										<SpeedInsights />
									</DirectionProvider>
								</ApiProvider>
							</NuqsAdapter>
						</NextIntlClientProvider>
					</EvlogProvider>
				</BaseLayoutPostHogProvider>
				{process.env.VERCEL_ENV !== "production" && <VercelToolbar />}
			</body>
			{}
		</html>
	);
};
