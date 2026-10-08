"use client";

import { ChartLineData02Icon } from "@hugeicons/core-free-icons";
import { useFormatter, useTranslations } from "next-intl";

import { DashboardFrame, DashboardFrameHeader } from "@/app/[locale]/dashboard/components/dashboard-frame";
import type { client } from "@/lib/api-client";
import { SpectrumChart } from "@starter/ui/components/charts/genui-charts";
import { FramePanel } from "@starter/ui/components/frame";

type Overview = Awaited<ReturnType<typeof client.analytics.overview>>;

export const AnalyticsTrend = ({ data }: { data: Overview }) => {
	const t = useTranslations("analytics");
	const format = useFormatter();
	const hourly = data.interval === "hour";

	const label = (date: string) =>
		hourly
			? format.dateTime(new Date(date), { hour: "numeric", timeZone: "UTC" })
			: format.dateTime(new Date(`${date}T12:00:00Z`), {
					day: "numeric",
					month: "short",
					timeZone: "UTC",
					year: data.from.slice(0, 4) === data.to.slice(0, 4) ? undefined : "numeric",
				});

	return (
		<DashboardFrame label={t("trends")}>
			<DashboardFrameHeader
				action={
					<p className='shrink-0 text-sm text-muted-foreground'>
						{format.dateTimeRange(new Date(`${data.from}T12:00:00Z`), new Date(`${data.to}T12:00:00Z`), {
							dateStyle: "medium",
							timeZone: "UTC",
						})}
					</p>
				}
				icon={ChartLineData02Icon}
				title={t("trends")}
			/>
			<FramePanel className='flex-1'>
				<SpectrumChart
					ariaLabel={t("trends")}
					height={280}
					kind='area'
					labels={data.series.map(({ date }) => label(date))}
					series={[
						{ category: t("kpis.visitors"), values: data.series.map(({ visitors }) => visitors) },
						{ category: t("kpis.pageviews"), values: data.series.map(({ pageviews }) => pageviews) },
					]}
					xAxisTicks={hourly ? 6 : 5}
					yAxisTicks={Math.min(4, Math.max(1, ...data.series.map(({ pageviews }) => pageviews)))}
				/>
			</FramePanel>
		</DashboardFrame>
	);
};
