"use client";

import { useState } from "react";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import { DashboardDrawer, DashboardDrawerHeader } from "@/app/[locale]/dashboard/components/dashboard-drawer";
import type { AnalyticsFilters, AnalyticsMetrics } from "@starter/analytics";
import { Button } from "@starter/ui/components/button";
import { DrawerPanel } from "@starter/ui/components/drawer";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@starter/ui/components/input-group";
import { Skeleton } from "@starter/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@starter/ui/components/tabs";

import type { AnalyticsRow, AnalyticsView } from "./analytics-breakdown-card";
import { AnalyticsRows } from "./analytics-breakdown-card";
import { sourceName, useCountryName } from "./analytics-labels";
import { useAnalyticsBreakdownPages } from "./use-analytics-breakdown";

const useRowSearch = (view: AnalyticsView) => {
	const countryName = useCountryName();

	const label = (key: string) => {
		const [country = "", city = ""] = key.split("|");

		if (view.dimension === "countries") {
			return countryName(key);
		}

		if (view.dimension === "cities") {
			return `${city} ${countryName(country)}`;
		}

		return sourceName(key);
	};

	return (row: AnalyticsRow, query: string) =>
		`${row.key} ${label(row.key)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
};

const DrawerRows = ({
	filters,
	query,
	total,
	view,
}: {
	filters: AnalyticsFilters;
	query: string;
	total: number;
	view: AnalyticsView;
}) => {
	const t = useTranslations("analytics");
	const pages = useAnalyticsBreakdownPages({ dimension: view.dimension, filters });
	const matches = useRowSearch(view);

	if (pages.isPending) {
		return (
			<div aria-label={t("loading")} className='grid gap-1' role='status'>
				{["a", "b", "c", "d", "e", "f", "g", "h"].map((key) => (
					<Skeleton className='h-11 w-full' key={key} />
				))}
			</div>
		);
	}

	if (pages.isError) {
		return (
			<div className='flex flex-col items-center gap-3 py-10 text-sm' role='alert'>
				<p className='text-muted-foreground'>{t("unavailable")}</p>
				<Button onClick={() => pages.refetch()} size='sm' variant='outline'>
					{t("retry")}
				</Button>
			</div>
		);
	}

	const rows = pages.data.pages.flatMap((page) => page.data).filter((row) => matches(row, query));

	return (
		<div className='grid gap-4'>
			<AnalyticsRows rows={rows} size='lg' total={total} view={view} />
			{pages.hasNextPage && (
				<Button
					className='justify-self-center'
					loading={pages.isFetchingNextPage}
					onClick={() => pages.fetchNextPage()}
					variant='outline'
				>
					{t("loadMore")}
				</Button>
			)}
		</div>
	);
};

export const AnalyticsBreakdownDrawer = ({
	filters,
	icon,
	onOpenChange,
	onViewChange,
	open,
	totals,
	view,
	views,
}: {
	filters: AnalyticsFilters;
	icon: IconSvgElement;
	onOpenChange: (open: boolean) => void;
	onViewChange: (dimension: AnalyticsView["dimension"]) => void;
	open: boolean;
	totals: AnalyticsMetrics;
	view: AnalyticsView;
	views: Array<AnalyticsView>;
}) => {
	const t = useTranslations("analytics");
	const format = useFormatter();
	const [query, setQuery] = useState("");

	const period =
		filters.from && filters.to
			? format.dateTimeRange(new Date(`${filters.from}T12:00:00Z`), new Date(`${filters.to}T12:00:00Z`), {
					dateStyle: "medium",
					timeZone: "UTC",
				})
			: "";

	return (
		<DashboardDrawer closeLabel={t("close")} onOpenChange={onOpenChange} open={open}>
			<DashboardDrawerHeader
				description={[t(`reportTitles.${view.dimension}`), period].filter(Boolean).join(" · ")}
				leading={<HugeiconsIcon className='size-6 scale-110' icon={icon} strokeWidth={1.75} />}
				title={t(`views.${view.dimension}`)}
			>
				<dl className='flex justify-center md:justify-start'>
					<div className='grid gap-1 text-center md:text-start'>
						<dt className='text-sm text-muted-foreground'>{t(`metricColumns.${view.metric}`)}</dt>
						<dd className='text-3xl tracking-tight tabular-nums'>{format.number(totals[view.metric])}</dd>
					</div>
				</dl>
			</DashboardDrawerHeader>
			{views.length > 1 && (
				<Tabs
					onValueChange={(value) => {
						const next = views.find(({ dimension }) => dimension === value);

						if (next) {
							onViewChange(next.dimension);
						}
					}}
					spacing='none'
					value={view.dimension}
				>
					<TabsList aria-label={t("reports")} surface='panel'>
						{views.map(({ dimension }) => (
							<TabsTrigger key={dimension} size='lg' value={dimension}>
								{t(`views.${dimension}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			)}
			<DrawerPanel padding='spacious'>
				<div className='grid content-start gap-5 pb-10'>
					<InputGroup>
						<InputGroupAddon>
							<HugeiconsIcon aria-hidden className='scale-110' icon={Search01Icon} strokeWidth={1.75} />
						</InputGroupAddon>
						<InputGroupInput
							aria-label={t("search")}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("search")}
							type='search'
							value={query}
						/>
					</InputGroup>
					<div className='grid gap-2'>
						<div className='flex justify-between px-3 text-xs text-muted-foreground'>
							<span>{t(`columns.${view.dimension}`)}</span>
							<span className='pe-13'>{t(`metricColumns.${view.metric}`)}</span>
						</div>
						{open && (
							<DrawerRows
								filters={filters}
								key={view.dimension}
								query={query}
								total={totals[view.metric]}
								view={view}
							/>
						)}
					</div>
				</div>
			</DrawerPanel>
		</DashboardDrawer>
	);
};
