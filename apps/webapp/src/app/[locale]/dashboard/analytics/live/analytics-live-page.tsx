"use client";

import { ArrowLeft01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import {
	DashboardFrame,
	DashboardFrameHeader,
	DashboardFramePanel,
} from "@/app/[locale]/dashboard/components/dashboard-frame";
import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";
import { FramePanel } from "@starter/ui/components/frame";
import { Skeleton } from "@starter/ui/components/skeleton";

import { AnalyticsGlobe } from "../analytics-globe";
import { AnalyticsFlag, useCountryName } from "../analytics-labels";
import { LivePulse, LiveVisitorList } from "../analytics-live";
import { useAnalyticsLive } from "../use-analytics-live";

export const AnalyticsLivePage = () => {
	const t = useTranslations("analytics");
	const format = useFormatter();
	const countryName = useCountryName();
	const { points, query, visitors } = useAnalyticsLive({});

	const countries = [
		...Map.groupBy(
			visitors.filter(({ country }) => country),
			({ country }) => country
		),
	]
		.map(([country, group]) => ({ count: group.length, country }))
		.toSorted((a, b) => b.count - a.count)
		.slice(0, 6);

	return (
		<>
			<Header
				item={{ href: "/dashboard/analytics", labelTx: "analytics" }}
				leading={
					<div className='flex items-center gap-2'>
						<Button
							aria-label={t("live.back")}
							nativeButton={false}
							render={<Link aria-label={t("live.back")} href='/dashboard/analytics' />}
							size='icon-sm'
							variant='ghost'
						>
							<HugeiconsIcon
								aria-hidden
								className='scale-110'
								icon={ArrowLeft01Icon}
								strokeWidth={1.75}
							/>
						</Button>
						<h1 className='text-base'>{t("live.pageTitle")}</h1>
					</div>
				}
			/>
			<main className='grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_24rem]'>
				<DashboardFrame label={t("live.globe")}>
					<FramePanel
						className='relative flex flex-1 items-center justify-center overflow-hidden'
						elevation='flat'
					>
						<div className='absolute start-5 top-5 z-10 grid gap-1'>
							<p className='flex items-center gap-2 text-sm text-muted-foreground'>
								<LivePulse />
								{t("live.title")}
							</p>
							<p className='text-4xl tracking-tight tabular-nums'>
								{query.isPending ? "–" : format.number(visitors.length)}
							</p>
							<p className='text-sm text-muted-foreground'>
								{t("live.online", { count: visitors.length })}
							</p>
						</div>
						{countries.length > 0 && (
							<ul className='absolute start-5 bottom-5 z-10 flex max-w-[calc(100%-2.5rem)] flex-wrap gap-1.5'>
								{countries.map(({ count, country }) => (
									<li
										className='flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs smooth-shadow-ring-md backdrop-blur-sm'
										key={country}
									>
										<AnalyticsFlag country={country} />
										{countryName(country)}
										<span className='text-muted-foreground tabular-nums'>
											{format.number(count)}
										</span>
									</li>
								))}
							</ul>
						)}
						<AnalyticsGlobe
							className='my-10 max-w-[min(42rem,75dvh)]'
							label={t("live.globe")}
							points={points}
						/>
					</FramePanel>
				</DashboardFrame>
				<DashboardFrame label={t("live.visitors")}>
					<DashboardFrameHeader icon={UserMultipleIcon} title={t("live.visitors")} />
					<DashboardFramePanel>
						{query.isPending && <Skeleton aria-label={t("loading")} className='m-2 h-40' role='status' />}
						{query.isError && (
							<div className='flex flex-col items-center gap-3 py-10 text-sm' role='alert'>
								<p className='text-muted-foreground'>{t("unavailable")}</p>
								<Button onClick={() => query.refetch()} size='sm' variant='outline'>
									{t("retry")}
								</Button>
							</div>
						)}
						{query.isSuccess && !visitors.length && (
							<p className='py-10 text-center text-sm text-muted-foreground'>{t("live.nobody")}</p>
						)}
						<LiveVisitorList visitors={visitors} />
					</DashboardFramePanel>
				</DashboardFrame>
			</main>
		</>
	);
};
