import { z } from "zod";

export const analyticsSurfaceSchema = z.enum(["website", "links", "blog"]);

export const analyticsFiltersSchema = z
	.strictObject({
		domain: z.string().trim().max(253).default(""),
		from: z.iso.date().optional(),
		locale: z.string().trim().max(10).default(""),
		surface: analyticsSurfaceSchema.optional(),
		to: z.iso.date().optional(),
	})
	.meta({ id: "AnalyticsFilters" });

export const analyticsDimensions = [
	"pages",
	"entryPages",
	"exitPages",
	"channels",
	"sources",
	"aiSources",
	"campaigns",
	"utmSources",
	"utmMediums",
	"countries",
	"cities",
	"devices",
	"browsers",
	"os",
	"actions",
	"links",
	"domains",
	"locales",
] as const;

export const analyticsBreakdownInputSchema = analyticsFiltersSchema
	.extend({
		dimension: z.enum(analyticsDimensions),
		limit: z.int().min(1).max(100).default(20),
		offset: z.int().min(0).max(10_000).default(0),
	})
	.meta({ id: "AnalyticsBreakdownInput" });

export const analyticsMetricsSchema = z
	.object({
		bounceRate: z.number().min(0).max(1),
		conversionRate: z.number().min(0).max(1),
		conversions: z.number().nonnegative(),
		duration: z.number().nonnegative(),
		engagedTime: z.number().nonnegative(),
		newVisitors: z.number().nonnegative(),
		pageviews: z.number().nonnegative(),
		returningVisitors: z.number().nonnegative(),
		visitors: z.number().nonnegative(),
		visits: z.number().nonnegative(),
	})
	.meta({ id: "AnalyticsMetrics" });

export const analyticsOverviewSchema = z
	.object({
		current: analyticsMetricsSchema,
		from: z.iso.date(),
		interval: z.enum(["day", "hour"]),
		previous: analyticsMetricsSchema,
		previousAvailable: z.boolean(),
		previousFrom: z.iso.date(),
		previousTo: z.iso.date(),
		series: z.array(analyticsMetricsSchema.extend({ date: z.union([z.iso.date(), z.iso.datetime()]) })),
		to: z.iso.date(),
	})
	.meta({ id: "AnalyticsOverview" });

export const analyticsBreakdownSchema = z
	.object({
		data: z.array(
			z.object({
				conversions: z.number(),
				key: z.string(),
				pageviews: z.number(),
				visitors: z.number(),
				visits: z.number(),
			})
		),
		hasMore: z.boolean(),
	})
	.meta({ id: "AnalyticsBreakdown" });

export const analyticsRealtimeSchema = z
	.object({ visitors: z.number().nonnegative() })
	.meta({ id: "AnalyticsRealtime" });

export const analyticsLiveSchema = z
	.object({
		data: z.array(
			z.object({
				browser: z.string(),
				city: z.string(),
				country: z.string(),
				device: z.string(),
				key: z.string(),
				lastSeen: z.iso.datetime(),
				latitude: z.number(),
				longitude: z.number(),
				os: z.string(),
				pageviews: z.number().nonnegative(),
				pathname: z.string(),
				referrer: z.string(),
			})
		),
	})
	.meta({ id: "AnalyticsLive" });

export const analyticsWebVitalsSchema = z
	.object({
		data: z.array(
			z.object({
				device: z.string(),
				metric: z.enum(["LCP", "INP", "CLS"]),
				p75: z.number().nonnegative(),
				samples: z.number().nonnegative(),
			})
		),
	})
	.meta({ id: "AnalyticsWebVitals" });

export const analyticsIdentitySchema = z.strictObject({
	sessionId: z.uuid(),
	visitorId: z.uuid(),
	visitorSince: z.iso.datetime(),
});

const analyticsPathSchema = z.string().startsWith("/").max(2048);

const eventBase = analyticsIdentitySchema.extend({
	campaign: z
		.strictObject({
			content: z.string().max(64).default(""),
			medium: z.string().max(64).default(""),
			name: z.string().max(64).default(""),
			source: z.string().max(64).default(""),
			term: z.string().max(64).default(""),
		})
		.default({ content: "", medium: "", name: "", source: "", term: "" }),
	id: z.uuid(),
	path: analyticsPathSchema,
	referrer: z.string().max(2048).default(""),
	timestamp: z.iso.datetime(),
});

export const analyticsEventSchema = z.discriminatedUnion("action", [
	eventBase.extend({ action: z.literal("page_view") }),
	eventBase.extend({ action: z.literal("link_click"), linkId: z.uuid() }),
	eventBase.extend({ action: z.literal("outbound_click"), href: z.string().min(1).max(2048) }),
	eventBase.extend({ action: z.literal("engagement"), engagedTime: z.number().finite().positive().max(1_800_000) }),
	eventBase.extend({
		action: z.literal("web_vital"),
		metric: z.enum(["LCP", "INP", "CLS"]),
		metricId: z.string().min(1).max(100),
		sequence: z.number().finite().nonnegative(),
		value: z.number().finite().nonnegative().max(3_600_000),
	}),
]);

export const analyticsBatchSchema = z.strictObject({ events: z.array(analyticsEventSchema).min(1).max(32) });

export const analyticsContactContextSchema = analyticsIdentitySchema.extend({ path: analyticsPathSchema });

export type AnalyticsEvent = z.output<typeof analyticsEventSchema>;

export type AnalyticsFilters = z.input<typeof analyticsFiltersSchema>;

export type AnalyticsMetrics = z.output<typeof analyticsMetricsSchema>;

export type AnalyticsContactContext = z.output<typeof analyticsContactContextSchema>;
