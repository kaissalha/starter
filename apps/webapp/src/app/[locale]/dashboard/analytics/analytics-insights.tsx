"use client";

import { useState } from "react";

import {
	Cursor01Icon,
	DashboardSpeed01Icon,
	Door01Icon,
	RepeatIcon,
	UserAdd01Icon,
	UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import {
	DashboardFrame,
	DashboardFrameHeader,
	DashboardFramePanel,
} from "@/app/[locale]/dashboard/components/dashboard-frame";
import type { client } from "@/lib/api-client";
import type { AnalyticsMetrics } from "@starter/analytics";
import { Badge } from "@starter/ui/components/badge";
import type { CSSPropertiesWithVariables } from "@starter/ui/components/sidebar";
import { Skeleton } from "@starter/ui/components/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@starter/ui/components/toggle-group";
import { cn } from "@starter/ui/lib/utils";

type Vitals = Awaited<ReturnType<typeof client.analytics.webVitals>>["data"];

const thresholds = { CLS: [0.1, 0.25], INP: [200, 500], LCP: [2500, 4000] } as const;

const ratings = { good: "optimal", poor: "critical", slow: "suboptimal" } as const;

export const AnalyticsLoyalty = ({ metrics }: { metrics: AnalyticsMetrics }) => {
	const t = useTranslations("analytics");
	const format = useFormatter();
	const total = metrics.newVisitors + metrics.returningVisitors;

	const segments = [
		{ className: "bg-chart-1", icon: UserAdd01Icon, key: "newVisitors", value: metrics.newVisitors },
		{ className: "bg-chart-2", icon: RepeatIcon, key: "returningVisitors", value: metrics.returningVisitors },
	] as const;

	const facts = [
		{ icon: Door01Icon, key: "pagesPerVisit", value: metrics.visits ? metrics.pageviews / metrics.visits : 0 },
		{
			icon: UserMultipleIcon,
			key: "visitsPerVisitor",
			value: metrics.visitors ? metrics.visits / metrics.visitors : 0,
		},
		{ icon: Cursor01Icon, key: "actionRate", value: metrics.conversionRate },
	] as const;

	return (
		<DashboardFrame label={t("loyalty")}>
			<DashboardFrameHeader icon={UserMultipleIcon} title={t("loyalty")} />
			<DashboardFramePanel>
				<div className='grid gap-4 px-3 pt-2 pb-3'>
					<dl className='grid grid-cols-2 gap-3'>
						{segments.map(({ className, key, value }) => (
							<div className='grid gap-1' key={key}>
								<dt className='flex items-center gap-2 text-sm text-muted-foreground'>
									<span aria-hidden className={cn("size-2 rounded-full", className)} />
									{t(key)}
								</dt>
								<dd className='flex items-baseline gap-2'>
									<span className='text-2xl tracking-tight tabular-nums'>{format.number(value)}</span>
									<span className='text-sm text-muted-foreground tabular-nums'>
										{total
											? format.number(value / total, {
													maximumFractionDigits: 0,
													style: "percent",
												})
											: null}
									</span>
								</dd>
							</div>
						))}
					</dl>
					<div aria-hidden className='flex h-2 gap-1'>
						{total ? (
							segments.flatMap(({ className, key, value }) =>
								value > 0
									? [
											<span
												className={cn(
													"grow-(--grow) rounded-full transition-[flex-grow] duration-500 ease-out",
													className
												)}
												key={key}
												style={{ "--grow": value } satisfies CSSPropertiesWithVariables}
											/>,
										]
									: []
							)
						) : (
							<span className='flex-1 rounded-full bg-muted' />
						)}
					</div>
				</div>
				<dl className='mt-auto grid gap-0.5'>
					{facts.map(({ icon, key, value }) => (
						<div className='flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm' key={key}>
							<HugeiconsIcon
								aria-hidden
								className='size-4 shrink-0 scale-110 text-muted-foreground'
								icon={icon}
								strokeWidth={1.75}
							/>
							<dt className='min-w-0 flex-1 text-muted-foreground'>{t(key)}</dt>
							<dd className='tabular-nums'>
								{key === "actionRate"
									? format.number(value, { maximumFractionDigits: 1, style: "percent" })
									: format.number(value, { maximumFractionDigits: 1 })}
							</dd>
						</div>
					))}
				</dl>
			</DashboardFramePanel>
		</DashboardFrame>
	);
};

const devices = ["all", "mobile", "desktop"] as const;

const rateVital = (metric: keyof typeof thresholds, value: number) => {
	const [good, fair] = thresholds[metric];

	if (value <= good) {
		return "good";
	}

	return value <= fair ? "slow" : "poor";
};

const useVitalValue = () => {
	const t = useTranslations("analytics");
	const format = useFormatter();

	return (metric: keyof typeof thresholds, value: number) => {
		if (metric === "CLS") {
			return format.number(value, { maximumFractionDigits: 2 });
		}

		if (metric === "LCP") {
			return t("durationSeconds", { seconds: format.number(value / 1000, { maximumFractionDigits: 1 }) });
		}

		return t("milliseconds", { value: format.number(Math.round(value)) });
	};
};

export const AnalyticsSpeed = ({ data, loading }: { data: Vitals | undefined; loading: boolean }) => {
	const t = useTranslations("analytics");
	const vitalValue = useVitalValue();
	const [device, setDevice] = useState<(typeof devices)[number]>("all");

	const metrics = (["LCP", "INP", "CLS"] as const).map((metric) => ({
		metric,
		row: data?.find((row) => row.metric === metric && row.device === device),
	}));

	return (
		<DashboardFrame label={t("speed")}>
			<DashboardFrameHeader
				action={
					<ToggleGroup
						aria-label={t("devices")}
						onValueChange={(value) => setDevice(devices.find((entry) => value.includes(entry)) ?? "all")}
						size='sm'
						value={[device]}
					>
						{devices.map((entry) => (
							<ToggleGroupItem key={entry} value={entry}>
								{t(entry === "all" ? "allDevices" : entry)}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				}
				icon={DashboardSpeed01Icon}
				title={t("speed")}
			/>
			<DashboardFramePanel>
				{loading ? (
					<Skeleton aria-label={t("loading")} className='m-2 h-36' role='status' />
				) : (
					<ul className='grid gap-0.5'>
						{metrics.map(({ metric, row }) => {
							const rating = row ? rateVital(metric, row.p75) : null;

							return (
								<li className='flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm' key={metric}>
									<p className='min-w-0 flex-1'>{t(`vitalNames.${metric}`)}</p>
									<span className='tabular-nums'>{row ? vitalValue(metric, row.p75) : "–"}</span>
									{rating ? (
										<Badge className='shrink-0 whitespace-nowrap' variant={ratings[rating]}>
											{t(`ratings.${rating}`)}
										</Badge>
									) : (
										<Badge className='shrink-0 whitespace-nowrap'>{t("ratings.none")}</Badge>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</DashboardFramePanel>
		</DashboardFrame>
	);
};
