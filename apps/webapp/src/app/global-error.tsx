"use client";

import { useEffect } from "react";

import { RotateLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { usePostHog } from "@posthog/next";

import { ErrorPageView } from "@/components/layout/error-page-view";
import enMessages from "@/i18n/messages/en.json";
import { routing } from "@/i18n/routing";
import { Button } from "@starter/ui/components/button";
import { getDirection } from "@starter/utils";
import "@starter/ui/globals.css";

type GlobalErrorProps = {
	error: Error & { digest?: string };
	retry: () => void;
};

const { globalError } = enMessages;

export default function GlobalError({ error, retry }: GlobalErrorProps) {
	const locale = routing.defaultLocale;
	const dir = getDirection(locale);

	const posthog = usePostHog();

	useEffect(() => {
		posthog?.captureException(error, { digest: error.digest });
	}, [error, posthog]);

	return (
		<html dir={dir} lang={locale} suppressHydrationWarning>
			<head>
				<title>{globalError.globalTitle}</title>
			</head>
			<body className='antialiased overflow-x-hidden max-w-dvw bg-background text-foreground'>
				<ErrorPageView
					description={globalError.globalDescription}
					retryControl={
						<Button onClick={() => retry()}>
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110'
								icon={RotateLeft01Icon}
								strokeWidth={1.75}
							/>
							<span className='px-1'>{globalError.tryAgain}</span>
						</Button>
					}
					title={globalError.globalTitle}
				/>
			</body>
		</html>
	);
}
