"use client";

import type { ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import type { AppConfig } from "next-intl";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api-client";
import { SidebarTrigger } from "@starter/ui/components/sidebar";
import { cn } from "@starter/ui/lib/utils";

export type HeaderProps = {
	actions?: ReactNode;
	className?: string;
	item:
		| { href?: string; label?: never; labelTx: keyof AppConfig["Messages"]["breadcrumbs"] }
		| { href?: string; label: string; labelTx?: never };
	leading?: ReactNode;
};

export const Header = ({ actions, className, item, leading }: HeaderProps) => {
	const t = useTranslations("breadcrumbs");
	const tCommon = useTranslations("common");
	const counts = useQuery(apiClient.notifications.counts.queryOptions({ refetchInterval: 30 * 1000 }));
	const unseen = counts.data?.unseen ?? 0;
	const label = item.labelTx === undefined ? item.label : t(item.labelTx);

	return (
		<header
			className={cn(
				"sticky top-0 z-50 flex shrink-0 flex-wrap items-center justify-between gap-y-2 bg-background px-4 pt-4 pb-3 md:px-5",
				className
			)}
		>
			<div className='flex min-h-8 min-w-0 flex-1 items-center gap-3 md:gap-4'>
				<span className='relative -ms-1 shrink-0 md:hidden'>
					<SidebarTrigger aria-label={tCommon("toggleNavigation")} purpose='navigation' />
					{unseen > 0 && (
						<span
							aria-hidden='true'
							className='pointer-events-none absolute end-1.5 top-1.5 size-2 rounded-full bg-primary'
						/>
					)}
				</span>
				<div className='flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-none md:gap-3 no-scrollbar'>
					{leading === undefined ? (
						<span className='shrink-0 whitespace-nowrap text-lg leading-none'>{label}</span>
					) : (
						leading
					)}
				</div>
			</div>
			{actions && (
				<div className='flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2 md:justify-end'>
					{actions}
				</div>
			)}
		</header>
	);
};
