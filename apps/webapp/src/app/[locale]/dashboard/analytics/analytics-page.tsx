"use client";

import {
	AiBrain01Icon,
	Cursor01Icon,
	Door01Icon,
	Location01Icon,
	Route01Icon,
	SmartPhone01Icon,
} from "@hugeicons/core-free-icons";
import { ar, enUS } from "date-fns/locale";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { AnalyticsStatCards } from "@/app/[locale]/dashboard/components/analytics-stat-cards";
import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";
import { DateRangePicker } from "@starter/ui/components/date-picker";
import { Empty, EmptyTitle } from "@starter/ui/components/empty";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Skeleton } from "@starter/ui/components/skeleton";

import { AnalyticsBreakdownCard, type AnalyticsView } from "./analytics-breakdown-card";
import { AnalyticsLoyalty, AnalyticsSpeed } from "./analytics-insights";
import { AnalyticsLiveCard, LivePulse } from "./analytics-live";
import { AnalyticsTrend } from "./analytics-summary";
import { analyticsPeriods, useAnalyticsController } from "./use-analytics-controller";
import { useAnalyticsLive } from "./use-analytics-live";

const cards = [
	{
		icon: Door01Icon,
		id: "pages",
		views: [
			{ dimension: "pages", metric: "pageviews" },
			{ dimension: "entryPages", metric: "visits" },
			{ dimension: "exitPages", metric: "visits" },
		],
	},
	{
		icon: Route01Icon,
		id: "sources",
		views: [
			{ dimension: "channels", metric: "visitors" },
			{ dimension: "sources", metric: "visitors" },
			{ dimension: "campaigns", metric: "visitors" },
			{ dimension: "utmSources", metric: "visitors" },
			{ dimension: "utmMediums", metric: "visitors" },
		],
	},
	{
		icon: Location01Icon,
		id: "locations",
		views: [
			{ dimension: "countries", metric: "visitors" },
			{ dimension: "cities", metric: "visitors" },
		],
	},
	{
		icon: Cursor01Icon,
		id: "actions",
		views: [
			{ dimension: "actions", metric: "conversions" },
			{ dimension: "links", metric: "conversions" },
		],
	},
	{
		icon: SmartPhone01Icon,
		id: "technology",
		views: [
			{ dimension: "devices", metric: "visitors" },
			{ dimension: "browsers", metric: "visitors" },
			{ dimension: "os", metric: "visitors" },
		],
	},
	{ icon: AiBrain01Icon, id: "ai", views: [{ dimension: "aiSources", metric: "visitors" }] },
] satisfies Array<{ icon: typeof Door01Icon; id: string; views: Array<AnalyticsView> }>;

const languages = ["en", "ar"] as const;

const FilterSelect = ({
	label,
	onValueChange,
	options,
	value,
}: {
	label: string;
	onValueChange: (value: string | null) => void;
	options: Array<{ label: string; value: string }>;
	value: string;
}) => (
	<Select items={options} onValueChange={onValueChange} value={value}>
		<SelectTrigger aria-label={label} className='w-auto max-w-48'>
			<SelectValue />
		</SelectTrigger>
		<SelectPopup>
			{options.map(({ label: text, value: option }) => (
				<SelectItem key={option} value={option}>
					{text}
				</SelectItem>
			))}
		</SelectPopup>
	</Select>
);

const AnalyticsFilters = ({ controller }: { controller: ReturnType<typeof useAnalyticsController> }) => {
	const t = useTranslations("analytics");
	const tLanguage = useTranslations("language.options");
	const locale = useLocale();
	const surfaces = ["all", "website", "links", "blog"] as const;

	return (
		<div className='flex max-w-full flex-wrap items-center justify-end gap-2'>
			{controller.domains.length > 1 && (
				<FilterSelect
					label={t("domain")}
					onValueChange={(value) => controller.setDomain(value === "all" ? "" : value)}
					options={[
						{ label: t("allWebsites"), value: "all" },
						...controller.domains.map((domain) => ({ label: domain, value: domain })),
					]}
					value={controller.filters.domain || "all"}
				/>
			)}
			{controller.locales.length > 1 && (
				<FilterSelect
					label={t("locale")}
					onValueChange={(value) => controller.setLocale(value === "all" ? "" : value)}
					options={[
						{ label: t("allLanguages"), value: "all" },
						...controller.locales.map((code) => {
							const language = languages.find((entry) => entry === code);

							return { label: language ? tLanguage(language) : code, value: code };
						}),
					]}
					value={controller.filters.locale || "all"}
				/>
			)}
			<FilterSelect
				label={t("surface")}
				onValueChange={controller.setSurface}
				options={surfaces.map((value) => ({ label: t(value === "all" ? "allContent" : value), value }))}
				value={controller.filters.surface ?? "all"}
			/>
			<FilterSelect
				label={t("dates")}
				onValueChange={(value) =>
					controller.setPeriod(analyticsPeriods.find((period) => period === value) ?? null)
				}
				options={analyticsPeriods.map((value) => ({ label: t(`periods.${value}`), value }))}
				value={controller.period}
			/>
			{controller.period === "custom" && (
				<DateRangePicker
					calendarProps={{
						dir: locale === "ar" ? "rtl" : "ltr",
						disabled: [{ before: controller.firstDay }, { after: controller.lastDay }],
						endMonth: controller.lastDay,
						locale: locale === "ar" ? ar : enUS,
						startMonth: controller.firstDay,
					}}
					className='w-full sm:w-auto'
					formatStr='yyyy-MM-dd'
					onChange={controller.setRange}
					placeholder={t("dates")}
					value={controller.range}
				/>
			)}
		</div>
	);
};

const LiveBadge = ({ count }: { count: number | undefined }) => {
	const t = useTranslations("analytics");
	const format = useFormatter();
	const label = `${count === undefined ? "–" : format.number(count)} ${t("live.badge")}`;

	return (
		<Button
			nativeButton={false}
			render={<Link aria-label={label} href='/dashboard/analytics/live' />}
			size='sm'
			variant='ghost'
		>
			<LivePulse />
			<span className='tabular-nums text-foreground'>{count === undefined ? "–" : format.number(count)}</span>
			{t("live.badge")}
		</Button>
	);
};

export const AnalyticsPage = ({ initial }: { initial: { from: string; to: string } }) => {
	const t = useTranslations("analytics");
	const controller = useAnalyticsController(initial);
	const live = useAnalyticsLive(controller.filters);
	const { overview, vitals } = controller;
	const empty = overview.data?.current.pageviews === 0 && overview.data.current.conversions === 0;

	return (
		<>
			<Header
				actions={<AnalyticsFilters controller={controller} />}
				afterLabel={<LiveBadge count={controller.realtime.data?.visitors} />}
				className='max-sm:flex-col max-sm:items-stretch'
				item={{ labelTx: "analytics" }}
				leading={<h1 className='text-base'>{t("title")}</h1>}
			/>
			<main className='min-h-0 flex-1 overflow-y-auto p-4 md:p-6'>
				<div className='mx-auto grid max-w-screen-2xl gap-4'>
					{!controller.validRange && <p role='alert'>{t("invalidRange")}</p>}
					{controller.validRange && overview.isError && (
						<Empty role='alert'>
							<EmptyTitle>{t("unavailable")}</EmptyTitle>
							<Button onClick={() => overview.refetch()} variant='outline'>
								{t("retry")}
							</Button>
						</Empty>
					)}
					{controller.validRange && overview.isPending && (
						<div aria-label={t("loading")} className='grid gap-4' role='status'>
							<Skeleton className='h-28 w-full' />
							<Skeleton className='h-80 w-full' />
						</div>
					)}
					{controller.validRange && overview.data && (
						<>
							<AnalyticsStatCards data={overview.data} />
							{empty ? (
								<Empty>
									<EmptyTitle>{t("empty")}</EmptyTitle>
								</Empty>
							) : (
								<AnalyticsTrend data={overview.data} />
							)}
							<div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
								{cards.map((card) => (
									<AnalyticsBreakdownCard
										filters={controller.filters}
										icon={card.icon}
										key={card.id}
										totals={overview.data.current}
										views={card.views}
									/>
								))}
								<AnalyticsLiveCard query={live.query} visitors={live.visitors} />
								<AnalyticsLoyalty metrics={overview.data.current} />
								<AnalyticsSpeed data={vitals.data?.data} loading={vitals.isPending} />
							</div>
						</>
					)}
				</div>
			</main>
		</>
	);
};
