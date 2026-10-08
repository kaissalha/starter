"use client";

import { useState } from "react";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import {
	DashboardFrame,
	DashboardFrameAction,
	DashboardFrameHeader,
	DashboardFramePanel,
} from "@/app/[locale]/dashboard/components/dashboard-frame";
import type { AnalyticsFilters, AnalyticsMetrics } from "@starter/analytics";
import { Button } from "@starter/ui/components/button";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@starter/ui/components/menu";
import type { CSSPropertiesWithVariables } from "@starter/ui/components/sidebar";
import { Skeleton } from "@starter/ui/components/skeleton";
import { cn } from "@starter/ui/lib/utils";

import { AnalyticsBreakdownDrawer } from "./analytics-breakdown-drawer";
import { AnalyticsLabel, type AnalyticsDimension } from "./analytics-labels";
import { useAnalyticsBreakdown } from "./use-analytics-breakdown";

export type AnalyticsView = {
	dimension: AnalyticsDimension;
	metric: "conversions" | "pageviews" | "visitors" | "visits";
};

export type AnalyticsRow = { conversions: number; key: string; pageviews: number; visitors: number; visits: number };

export const AnalyticsRows = ({
	rows,
	size = "default",
	total,
	view,
}: {
	rows: Array<AnalyticsRow>;
	size?: "default" | "lg";
	total: number;
	view: AnalyticsView;
}) => {
	const t = useTranslations("analytics");
	const format = useFormatter();
	const max = Math.max(1, ...rows.map((row) => row[view.metric]));

	if (!rows.length) {
		return <p className='flex min-h-40 items-center justify-center text-sm text-muted-foreground'>{t("noData")}</p>;
	}

	return (
		<ul className={size === "lg" ? "grid gap-1" : "grid gap-0.5"}>
			{rows.map((row) => (
				<li
					className={cn(
						"relative isolate flex items-center gap-3 rounded-lg px-3 text-sm",
						size === "lg" ? "min-h-11" : "min-h-9"
					)}
					key={row.key}
					style={{ "--bar": `${(row[view.metric] / max) * 100}%` } satisfies CSSPropertiesWithVariables}
				>
					<span
						aria-hidden
						className='absolute inset-y-0.5 start-0 -z-10 w-(--bar) rounded-lg bg-primary/8 transition-[width] duration-300 ease-out dark:bg-primary/14'
					/>
					<span className='min-w-0 flex-1'>
						<AnalyticsLabel dimension={view.dimension} value={row.key} />
					</span>
					<span className='tabular-nums'>{format.number(row[view.metric])}</span>
					<span className='w-10 text-end text-xs text-muted-foreground tabular-nums'>
						{total > 0
							? format.number(row[view.metric] / total, { maximumFractionDigits: 0, style: "percent" })
							: null}
					</span>
				</li>
			))}
		</ul>
	);
};

const CardBody = ({ filters, total, view }: { filters: AnalyticsFilters; total: number; view: AnalyticsView }) => {
	const t = useTranslations("analytics");
	const query = useAnalyticsBreakdown({ dimension: view.dimension, filters });

	if (query.isPending) {
		return (
			<div aria-label={t("loading")} className='grid gap-2 p-1' role='status'>
				{["a", "b", "c", "d", "e"].map((key) => (
					<Skeleton className='h-7 w-full' key={key} />
				))}
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className='flex min-h-40 flex-col items-center justify-center gap-3 text-sm' role='alert'>
				<p className='text-muted-foreground'>{t("unavailable")}</p>
				<Button onClick={() => query.refetch()} size='sm' variant='outline'>
					{t("retry")}
				</Button>
			</div>
		);
	}

	return <AnalyticsRows rows={query.data.data.slice(0, 6)} total={total} view={view} />;
};

export const AnalyticsBreakdownCard = ({
	filters,
	icon,
	title,
	totals,
	views,
}: {
	filters: AnalyticsFilters;
	icon: IconSvgElement;
	title?: string;
	totals: AnalyticsMetrics;
	views: Array<AnalyticsView>;
}) => {
	const t = useTranslations("analytics");
	const [selected, setSelected] = useState(views[0]?.dimension);
	const [open, setOpen] = useState(false);
	const view = views.find(({ dimension }) => dimension === selected) ?? views[0];

	if (!view) {
		return null;
	}

	const heading = title ?? t(`views.${view.dimension}`);

	return (
		<DashboardFrame label={heading}>
			<DashboardFrameHeader
				action={<DashboardFrameAction onClick={() => setOpen(true)}>{t("seeAll")}</DashboardFrameAction>}
				heading={
					views.length > 1 && (
						<Menu>
							<MenuTrigger
								render={
									<Button
										aria-label={t("changeReport", { report: heading })}
										className='-ms-2'
										size='sm'
										variant='ghost'
									/>
								}
							>
								{heading}
								<HugeiconsIcon
									aria-hidden
									className='scale-110 text-muted-foreground'
									icon={ArrowDown01Icon}
									strokeWidth={1.75}
								/>
							</MenuTrigger>
							<MenuPopup align='start'>
								<MenuRadioGroup
									onValueChange={(value) =>
										setSelected(
											views.find(({ dimension }) => dimension === value)?.dimension ??
												view.dimension
										)
									}
									value={view.dimension}
								>
									{views.map(({ dimension }) => (
										<MenuRadioItem key={dimension} value={dimension}>
											{t(`views.${dimension}`)}
										</MenuRadioItem>
									))}
								</MenuRadioGroup>
							</MenuPopup>
						</Menu>
					)
				}
				icon={icon}
				title={heading}
			/>
			<DashboardFramePanel>
				<div className='flex justify-between px-3 pt-1 pb-2 text-xs text-muted-foreground'>
					<span>{t(`columns.${view.dimension}`)}</span>
					<span>{t(`metricColumns.${view.metric}`)}</span>
				</div>
				<CardBody filters={filters} total={totals[view.metric]} view={view} />
			</DashboardFramePanel>
			<AnalyticsBreakdownDrawer
				filters={filters}
				icon={icon}
				onOpenChange={setOpen}
				onViewChange={setSelected}
				open={open}
				totals={totals}
				view={view}
				views={views}
			/>
		</DashboardFrame>
	);
};
