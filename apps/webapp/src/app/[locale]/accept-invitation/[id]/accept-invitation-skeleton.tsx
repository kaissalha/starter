"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@starter/ui/components/skeleton";

export const AcceptInvitationSkeleton = () => {
	const t = useTranslations("common");

	return (
		<div className='flex min-h-dvh items-center justify-center p-6' role='status'>
			<span className='sr-only'>{t("loading")}</span>
			<div aria-hidden className='flex w-full max-w-md flex-col items-center gap-4'>
				<Skeleton className='size-12' corners='circle' />
				<Skeleton className='h-7 w-56 max-w-full' />
				<Skeleton className='h-4 w-80 max-w-full' />
				<Skeleton className='mt-3 h-10 w-full' />
			</div>
		</div>
	);
};
