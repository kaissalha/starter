"use client";

import type { ReactNode } from "react";

import { type IconSvgElement } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import type { AppConfig } from "next-intl";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api-client";
import { SidebarTrigger } from "@starter/ui/components/sidebar";
import { cn } from "@starter/ui/lib/utils";

export type BreadcrumbItemProp =
	| {
			href?: string;
			icon?: IconSvgElement;
			label?: never;
			labelTx: keyof AppConfig["Messages"]["breadcrumbs"];
	  }
	| {
			href?: string;
			icon?: IconSvgElement;
			label: string;
			labelTx?: never;
	  };

export type HeaderProps = {
	actions?: ReactNode;

	afterLabel?: ReactNode;
	center?: ReactNode;
	centerClassName?: string;
	className?: string;
	item: BreadcrumbItemProp;

	leading?: ReactNode;
};

export const Header = ({ actions, afterLabel, center, centerClassName, className, item, leading }: HeaderProps) => {
	const t = useTranslations("breadcrumbs");
	const tCommon = useTranslations("common");
	const counts = useQuery(apiClient.notifications.counts.queryOptions({ refetchInterval: 30 * 1000 }));
	const unseen = counts.data?.unseen ?? 0;
	const label = item.labelTx === undefined ? item.label : t(item.labelTx);

	const leadingContent =
		leading === undefined ? (
			<span className='shrink-0 whitespace-nowrap text-lg leading-none'>{label}</span>
		) : (
			leading
		);

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
					{leadingContent}
					{afterLabel ? (
						<>
							{leadingContent ? (
								<span aria-hidden className='hidden h-4 w-px shrink-0 bg-border sm:block' />
							) : null}
							{afterLabel}
						</>
					) : null}
				</div>
			</div>
			{center && (
				<div
					className={cn(
						"order-last flex w-full items-center justify-center md:absolute md:start-1/2 md:order-none md:w-auto md:-translate-x-1/2",
						centerClassName
					)}
				>
					{center}
				</div>
			)}
			{actions && (
				<div className='flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2 md:justify-end'>
					{actions}
				</div>
			)}
		</header>
	);
};
