"use client";

import { GoogleIcon } from "@hugeicons/core-free-icons";
import { useFormatter, useTranslations } from "next-intl";

import {
	DashboardFrame,
	DashboardFrameEmpty,
	DashboardFrameHeader,
	DashboardFramePanel,
} from "@/app/[locale]/dashboard/components/dashboard-frame";
import { Button } from "@starter/ui/components/button";
import { Skeleton } from "@starter/ui/components/skeleton";

import type { SeoGeoController } from "./use-seo-geo-controller";

const SearchBody = ({ controller }: { controller: SeoGeoController }) => {
	const t = useTranslations("seoGeo.searchConsole");
	const format = useFormatter();
	const { data, isError, isPending } = controller.search;

	if (isPending) {
		return <Skeleton aria-label={t("title")} className='m-1 h-28' role='status' />;
	}

	if (isError || data.status === "unavailable") {
		return <DashboardFrameEmpty>{t("unavailable")}</DashboardFrameEmpty>;
	}

	if (data.status !== "available") {
		return (
			<DashboardFrameEmpty>
				{data.status === "notConnected" ? (
					<Button
						loading={controller.connect === "pending"}
						onClick={() => controller.connectGoogle()}
						variant='secondary'
					>
						{t("connect")}
					</Button>
				) : (
					t(data.status)
				)}
			</DashboardFrameEmpty>
		);
	}

	return (
		<div className='grid gap-3'>
			<dl className='grid grid-cols-2 gap-3 px-3 pt-2'>
				{(["clicks", "impressions"] as const).map((key) => (
					<div className='grid gap-1' key={key}>
						<dt className='text-sm text-muted-foreground'>{t(key)}</dt>
						<dd className='text-2xl tracking-tight tabular-nums'>{format.number(data[key])}</dd>
					</div>
				))}
			</dl>
			<p className='px-3 text-xs text-muted-foreground'>
				{t("period", { end: data.endDate, start: data.startDate })}
			</p>
			{data.queries.length > 0 && (
				<div className='grid gap-1'>
					<div className='flex justify-between px-3 pt-2 text-xs text-muted-foreground'>
						<span>{t("topQueries")}</span>
						<span>{t("clicks")}</span>
					</div>
					<ul className='grid gap-0.5'>
						{data.queries.map((row) => (
							<li className='flex min-h-9 items-center gap-3 rounded-lg px-3 text-sm' key={row.query}>
								<span className='min-w-0 flex-1 truncate'>{row.query}</span>
								<span className='tabular-nums'>{format.number(row.clicks)}</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};

export const SeoGeoSearch = ({ controller }: { controller: SeoGeoController }) => {
	const t = useTranslations("seoGeo.searchConsole");

	return (
		<DashboardFrame label={t("title")}>
			<DashboardFrameHeader description={t("description")} icon={GoogleIcon} title={t("title")} />
			<DashboardFramePanel>
				<SearchBody controller={controller} />
			</DashboardFramePanel>
		</DashboardFrame>
	);
};
