"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@starter/ui/components/skeleton";

export const LoginPageSkeleton = () => {
	const t = useTranslations("common");

	return (
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
	);
};
