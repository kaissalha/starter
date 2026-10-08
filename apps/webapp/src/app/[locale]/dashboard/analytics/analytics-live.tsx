"use client";

import { Globe02Icon } from "@hugeicons/core-free-icons";
import { useFormatter, useNow, useTranslations } from "next-intl";

import {
	DashboardFrame,
	DashboardFrameAction,
	DashboardFrameHeader,
	DashboardFramePanel,
} from "@/app/[locale]/dashboard/components/dashboard-frame";
import type { client } from "@/lib/api-client";
import { Skeleton } from "@starter/ui/components/skeleton";
import { cn } from "@starter/ui/lib/utils";

import { AnalyticsDeviceIcon, AnalyticsFlag, sourceName, useCountryName } from "./analytics-labels";

type LiveVisitor = Awaited<ReturnType<typeof client.analytics.live>>["data"][number];

export const LivePulse = ({ className }: { className?: string }) => (
	<span aria-hidden className={cn("relative flex size-2", className)}>
		<span className='absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping' />
		<span className='relative inline-flex size-2 rounded-full bg-success' />
	</span>
);

export const LiveVisitorList = ({ compact = false, visitors }: { compact?: boolean; visitors: Array<LiveVisitor> }) => {
	const t = useTranslations("analytics");
	const format = useFormatter();
	const now = useNow({ updateInterval: 10_000 });
	const countryName = useCountryName();

	return (
		<ul className='grid gap-0.5'>
			{visitors.map((visitor) => (
				<li className='flex min-h-11 items-center gap-3 rounded-lg px-3 py-1.5 text-sm' key={visitor.key}>
					<AnalyticsFlag className='size-5' country={visitor.country} />
					<div className='min-w-0 flex-1'>
						<p className='truncate font-medium'>
							{visitor.city
								? `${visitor.city}, ${countryName(visitor.country)}`
								: countryName(visitor.country) || t("unknownLocation")}
						</p>
						<p className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
							<bdi className='truncate' dir='ltr'>
								{visitor.pathname === "/" ? t("homePage") : visitor.pathname}
							</bdi>
							{!compact && (
								<span className='shrink-0'>
									· {visitor.referrer ? sourceName(visitor.referrer) : t("direct")}
								</span>
							)}
						</p>
					</div>
					{!compact && <AnalyticsDeviceIcon device={visitor.device} />}
					<time className='shrink-0 text-xs text-muted-foreground tabular-nums' dateTime={visitor.lastSeen}>
						{format.relativeTime(new Date(visitor.lastSeen), now)}
					</time>
				</li>
			))}
		</ul>
	);
};

export const AnalyticsLiveCard = ({
	query,
	visitors,
}: {
	query: { isError: boolean; isPending: boolean };
	visitors: Array<LiveVisitor>;
}) => {
	const t = useTranslations("analytics");
	const format = useFormatter();

	return (
		<DashboardFrame label={t("live.title")}>
			<DashboardFrameHeader
				action={
					<DashboardFrameAction href='/dashboard/analytics/live' icon={Globe02Icon}>
						{t("live.open")}
					</DashboardFrameAction>
				}
				marker={<LivePulse />}
				title={t("live.title")}
			/>
			<DashboardFramePanel>
				<div aria-live='polite' className='flex items-baseline gap-2 px-3 pt-2 pb-3'>
					<span className='text-3xl tracking-tight tabular-nums'>
						{query.isPending ? "–" : format.number(visitors.length)}
					</span>
					<span className='text-sm text-muted-foreground'>
						{t("live.online", { count: visitors.length })}
					</span>
				</div>
				{query.isPending && <Skeleton className='mx-3 h-24' />}
				{query.isError && <p className='px-3 pb-3 text-sm text-muted-foreground'>{t("unavailable")}</p>}
				<LiveVisitorList compact visitors={visitors.slice(0, 4)} />
			</DashboardFramePanel>
		</DashboardFrame>
	);
};
