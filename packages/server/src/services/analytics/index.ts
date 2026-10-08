import { z } from "zod";

import {
	analyticsBreakdownInputSchema,
	analyticsFiltersSchema,
	analyticsLiveSchema,
	analyticsOverviewSchema,
	analyticsWebVitalsSchema,
	resolveAnalyticsDates,
	toAnalyticsDate,
	type AnalyticsFilters,
} from "@starter/analytics";
import {
	AnalyticsUnavailableError,
	createAnalyticsClient,
	type AnalyticsOverviewRow,
} from "@starter/analytics/tinybird";
import { log, serializeLogError } from "@starter/observability";

import { requireOrganizationPermission } from "../permissions";

type Actor = { organizationId: string; userId: string };

const queryAnalytics = async <T>({
	actor,
	input,
	query,
}: {
	actor: Actor;
	input: AnalyticsFilters;
	query: (context: {
		client: ReturnType<typeof createAnalyticsClient>;
		dates: ReturnType<typeof resolveAnalyticsDates>;
		params: {
			date_from: string;
			date_to: string;
			domain: string;
			locale: string;
			organization_id: string;
			surface: string;
		};
	}) => Promise<T>;
}) => {
	await requireOrganizationPermission({ ...actor, permission: "read" });
	const filters = analyticsFiltersSchema.parse(input);
	const dates = resolveAnalyticsDates(filters);

	try {
		return await query({
			client: createAnalyticsClient("read"),
			dates,
			params: {
				date_from: dates.from,
				date_to: dates.to,
				domain: filters.domain,
				locale: filters.locale,
				organization_id: actor.organizationId,
				surface: filters.surface ?? "",
			},
		});
	} catch (error) {
		await log.error({
			error: serializeLogError(error),
			message: "Analytics query failed",
			organizationId: actor.organizationId,
		});
		throw new AnalyticsUnavailableError();
	}
};

const mapMetrics = (row?: Partial<AnalyticsOverviewRow>) => ({
	bounceRate: row?.bounce_rate ?? 0,
	conversionRate: row?.conversion_rate ?? 0,
	conversions: row?.conversions ?? 0,
	duration: row?.duration ?? 0,
	engagedTime: row?.engaged_time ?? 0,
	newVisitors: row?.new_visitors ?? 0,
	pageviews: row?.pageviews ?? 0,
	returningVisitors: row?.returning_visitors ?? 0,
	visitors: row?.visitors ?? 0,
	visits: row?.visits ?? 0,
});

export const getAnalyticsOverview = (args: { actor: Actor; input: AnalyticsFilters }) =>
	queryAnalytics({
		...args,
		query: async ({ client, dates, params }) => {
			const [result, hourly] = await Promise.all([
				client.analyticsOverview.query({ ...params, previous_from: dates.previousFrom }),
				dates.days === 1 ? client.analyticsHourly.query(params) : null,
			]);

			const series = new Map(
				result.data.filter((row) => row.period === "current" && row.date).map((row) => [row.date, row])
			);

			const hours = new Map(hourly?.data.map((row) => [row.hour, row]));

			return analyticsOverviewSchema.parse({
				...dates,
				current: mapMetrics(result.data.find((row) => row.period === "current" && !row.date)),
				interval: hourly ? "hour" : "day",
				previous: mapMetrics(result.data.find((row) => row.period === "previous" && !row.date)),
				series: hourly
					? Array.from({ length: 24 }, (_, hour) => ({
							date: `${dates.from}T${String(hour).padStart(2, "0")}:00:00Z`,
							...mapMetrics(hours.get(hour)),
						}))
					: Array.from({ length: dates.days }, (_, index) => {
							const date = toAnalyticsDate(new Date(new Date(dates.from).getTime() + index * 86_400_000));

							return { date, ...mapMetrics(series.get(date)) };
						}),
			});
		},
	});

export const getAnalyticsBreakdown = ({
	actor,
	input,
}: {
	actor: Actor;
	input: z.input<typeof analyticsBreakdownInputSchema>;
}) => {
	const { dimension, limit, offset, ...filters } = analyticsBreakdownInputSchema.parse(input);

	return queryAnalytics({
		actor,
		input: filters,
		query: async ({ client, params }) => {
			const result = await client.analyticsBreakdown.query({ ...params, dimension, limit: limit + 1, offset });

			return { data: result.data.slice(0, limit), hasMore: result.data.length > limit };
		},
	});
};

export const getAnalyticsRealtime = (args: { actor: Actor; input: AnalyticsFilters }) =>
	queryAnalytics({
		...args,
		query: async ({ client, params }) => (await client.analyticsRealtime.query(params)).data[0] ?? { visitors: 0 },
	});

export const getAnalyticsLive = (args: { actor: Actor; input: AnalyticsFilters }) =>
	queryAnalytics({
		...args,
		query: async ({ client, params }) =>
			analyticsLiveSchema.parse({
				data: (await client.analyticsLive.query(params)).data.map(({ last_seen: lastSeen, ...row }) => ({
					...row,
					lastSeen,
				})),
			}),
	});

export const getAnalyticsWebVitals = (args: { actor: Actor; input: AnalyticsFilters }) =>
	queryAnalytics({
		...args,
		query: async ({ client, params }) =>
			analyticsWebVitalsSchema.parse(await client.analyticsWebVitals.query(params)),
	});
