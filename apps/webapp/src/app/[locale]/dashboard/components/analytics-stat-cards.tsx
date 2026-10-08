"use client";

import { ArrowDown01Icon, ArrowUp01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import type { client } from "@/lib/api-client";
import type { AnalyticsMetrics } from "@starter/analytics";
import { Button } from "@starter/ui/components/button";
import { SpectrumChart } from "@starter/ui/components/charts/genui-charts";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@starter/ui/components/frame";
import { Popover, PopoverPopup, PopoverTrigger } from "@starter/ui/components/popover";
import { cn } from "@starter/ui/lib/utils";

type Overview = Awaited<ReturnType<typeof client.analytics.overview>>;

export const analyticsKpis = ["visitors", "pageviews", "engagedTime", "bounceRate", "conversions"] as const;

type Kpi = (typeof analyticsKpis)[number];

const kpiValue = (key: Kpi, metrics: AnalyticsMetrics) =>
	key === "engagedTime" ? metrics.engagedTime || metrics.duration : metrics[key];

export const useDuration = () => {
	const t = useTranslations("analytics");
	const format = useFormatter();

	return (seconds: number) => {
		const rounded = Math.round(seconds);

		if (rounded < 60) {
			return t("durationSeconds", { seconds: format.number(rounded) });
		}

		return t("durationMinutes", { minutes: format.number(Math.floor(rounded / 60)), seconds: rounded % 60 });
	};
};

const Change = ({ change, lowerIsBetter }: { change: number; lowerIsBetter: boolean }) => {
	const t = useTranslations("analytics");
	const format = useFormatter();
	const good = lowerIsBetter ? change < 0 : change > 0;

	if (Math.abs(change) < 0.005) {
		return <span className='text-xs text-muted-foreground'>{t("noChange")}</span>;
	}

	return (
		<span
			className={cn(
				"inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-xs font-medium tabular-nums",
				good ? "bg-success/15 text-success-foreground" : "bg-destructive/10 text-destructive"
			)}
		>
			<HugeiconsIcon
				aria-hidden
				className='size-3 scale-110'
				icon={change > 0 ? ArrowUp01Icon : ArrowDown01Icon}
				strokeWidth={1.75}
			/>
			{format.number(Math.abs(change), { maximumFractionDigits: 0, style: "percent" })}
		</span>
	);
};

export const AnalyticsStatCards = ({
	data,
	metrics = analyticsKpis,
	sparkline = false,
}: {
	data: Overview;
	metrics?: ReadonlyArray<Kpi>;
	sparkline?: boolean;
}) => {
	const t = useTranslations("analytics");
	const format = useFormatter();
	const duration = useDuration();

	const display = (key: Kpi, value: number) => {
		if (key === "bounceRate") {
			return format.number(value, { maximumFractionDigits: 0, style: "percent" });
		}

		if (key === "engagedTime") {
			return duration(value);
		}

		return format.number(value, { maximumFractionDigits: 1, notation: value >= 10_000 ? "compact" : "standard" });
	};

	return (
		<div
			className={
				metrics.length === 5
					? "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
					: "grid gap-3 sm:grid-cols-3"
			}
		>
			{metrics.map((key) => {
				const current = kpiValue(key, data.current);
				const previous = kpiValue(key, data.previous);
				const change = data.previousAvailable && previous > 0 ? (current - previous) / previous : null;

				return (
					<Frame
						className={cn(
							"min-w-0",
							metrics.length === 5 && key === "conversions" && "max-xl:col-span-2 max-md:col-span-2"
						)}
						key={key}
					>
						<FrameHeader className='min-h-11 justify-between' layout='row'>
							<FrameTitle>
								<h2 className='truncate'>{t(`kpis.${key}`)}</h2>
							</FrameTitle>
							<Popover>
								<PopoverTrigger
									aria-label={t("kpiHelp", { metric: t(`kpis.${key}`) })}
									openOnHover
									render={<Button className='-me-3' size='icon-xs' variant='ghost' />}
								>
									<HugeiconsIcon
										aria-hidden
										className='scale-110'
										icon={InformationCircleIcon}
										strokeWidth={1.75}
									/>
								</PopoverTrigger>
								<PopoverPopup className='min-w-0 max-w-64' padding='sm'>
									<p className='text-sm'>{t(`kpiDefinitions.${key}`)}</p>
								</PopoverPopup>
							</Popover>
						</FrameHeader>
						<FramePanel className='flex-1' padding='none'>
							<div className='grid gap-1.5 px-4 py-3.5'>
								<div className='flex items-end justify-between gap-3'>
									<p
										className='min-w-0 truncate text-2xl tracking-tight tabular-nums sm:text-3xl'
										title={format.number(current)}
									>
										{display(key, current)}
									</p>
									{sparkline && (
										<div aria-hidden className='w-2/5 max-w-32 shrink-0' dir='ltr'>
											<SpectrumChart
												height={40}
												kind='area'
												labels={data.series.map(({ date }) => date)}
												presentation='sparkline'
												series={[
													{
														category: t(`kpis.${key}`),
														values: data.series.map((day) => kpiValue(key, day)),
													},
												]}
											/>
										</div>
									)}
								</div>
								{change !== null && (
									<p className='flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground'>
										<Change change={change} lowerIsBetter={key === "bounceRate"} />
										{t("vsPrevious")}
									</p>
								)}
							</div>
						</FramePanel>
					</Frame>
				);
			})}
		</div>
	);
};
