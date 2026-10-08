"use client";

import { useEffect } from "react";

import { RotateLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { usePostHog } from "@posthog/next";
import { useTranslations } from "next-intl";

import { ErrorPageView } from "@/components/layout/error-page-view";
import { Button } from "@starter/ui/components/button";

type ErrorProps = {
	error: Error & { digest?: string };
	retry: () => void;
};

export default function LocaleError({ error, retry }: ErrorProps) {
	const t = useTranslations("errorPage");
	const posthog = usePostHog();

	useEffect(() => {
		posthog?.captureException(error, { digest: error.digest });
	}, [error, posthog]);

	return (
		<ErrorPageView
			description={t("description")}
			retryControl={
				<Button onClick={() => retry()}>
					<HugeiconsIcon
						aria-hidden='true'
						className='scale-110'
						icon={RotateLeft01Icon}
						strokeWidth={1.75}
					/>
					<span className='px-1'>{t("reload")}</span>
				</Button>
			}
			title={t("title")}
		/>
	);
}
