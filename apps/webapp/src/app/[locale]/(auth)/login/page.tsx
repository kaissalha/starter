import { Suspense } from "react";

import type { Metadata } from "next";

import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Skeleton } from "@starter/ui/components/skeleton";

import { LoginPageClient } from "./login-page-client";

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations("account.login");

	return {
		robots: { follow: false, index: false },
		title: t("pageTitle"),
	};
};

export default function LoginPage() {
	const t = useTranslations("common");

	return (
		<Suspense
			fallback={
				<div className='relative flex min-h-dvh bg-background' role='status'>
					<span className='sr-only'>{t("loading")}</span>
					<div aria-hidden className='flex w-full items-center justify-center p-8 lg:w-1/2 lg:p-12'>
						<div className='flex w-full max-w-md flex-col items-center gap-3'>
							<Skeleton className='h-8 w-56 max-w-full' />
							<Skeleton className='mb-5 h-4 w-72 max-w-full' />
							<Skeleton className='h-11 w-full' />
							<Skeleton className='h-11 w-full' />
						</div>
					</div>
					<Skeleton aria-hidden className='m-2 hidden lg:block lg:w-1/2' />
				</div>
			}
		>
			<LoginPageClient />
		</Suspense>
	);
}
