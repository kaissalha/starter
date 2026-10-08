import { defineDatasource, defineMaterializedView, defineToken, engine, node, t, type InferRow } from "@tinybirdco/sdk";

export const analyticsAppend = defineToken("analytics_append");

export const analyticsRead = defineToken("analytics_read");

const dimensions = {
	browser: t.string().lowCardinality(),
	content_id: t.string(),
	device: t.string().lowCardinality(),
	domain: t.string(),
	locale: t.string().lowCardinality(),
	organization_id: t.string(),
	pathname: t.string(),
	surface: t.string().lowCardinality(),
	website_id: t.string(),
};

const trafficDimensions = {
	...dimensions,
	ai_source: t.string().lowCardinality(),
	campaign: t.string(),
	campaign_content: t.string(),
	campaign_medium: t.string(),
	campaign_source: t.string(),
	campaign_term: t.string(),
	country: t.string().lowCardinality(),
	destination: t.string(),
	link_id: t.string(),
	referrer: t.string(),
	session_id: t.string(),
	visitor_id: t.string(),
	visitor_since: t.dateTime64(3),
};

const rollupEngine = (keys: Array<string>) =>
	engine.aggregatingMergeTree({
		partitionKey: "toYYYYMM(day)",
		sortingKey: [
			"organization_id",
			"website_id",
			"day",
			...keys.toSorted().filter((key) => !["organization_id", "website_id"].includes(key)),
		],
		ttl: "day + INTERVAL 13 MONTH",
	});

export const analyticsEvents = defineDatasource("analytics_events", {
	engine: engine.mergeTree({
		partitionKey: "toYYYYMM(timestamp)",
		sortingKey: ["organization_id", "website_id", "timestamp"],
		ttl: "toDateTime(timestamp) + INTERVAL 90 DAY",
	}),
	forwardQuery: `SELECT browser, content_id, device, domain, locale, organization_id, pathname, surface, website_id,
	ai_source, campaign, campaign_content, campaign_medium, campaign_source, campaign_term, country, destination, link_id,
	referrer, session_id, visitor_id, visitor_since, action, defaultValueOfTypeName('String') AS city,
	defaultValueOfTypeName('Float64') AS engaged_time, event_id, defaultValueOfTypeName('Float32') AS latitude,
	defaultValueOfTypeName('Float32') AS longitude, metric, metric_id, metric_sequence, metric_value,
	defaultValueOfTypeName('LowCardinality(String)') AS os, timestamp`,
	schema: {
		...trafficDimensions,
		action: t.string().lowCardinality(),
		city: t.string().default(""),
		engaged_time: t.float64().default(0),
		event_id: t.string(),
		latitude: t.float32().default(0),
		longitude: t.float32().default(0),
		metric: t.string().lowCardinality(),
		metric_id: t.string(),
		metric_sequence: t.float64(),
		metric_value: t.float64(),
		os: t.string().lowCardinality().default(""),
		timestamp: t.dateTime64(3),
	},
	tokens: [{ scope: "APPEND", token: analyticsAppend }],
});

export const analyticsSessions = defineDatasource("analytics_sessions", {
	engine: rollupEngine(Object.keys(trafficDimensions)),
	jsonPaths: false,
	schema: {
		day: t.date(),
		...trafficDimensions,
		conversions: t.aggregateFunction("uniqExact", t.string()),
		first_activity: t.simpleAggregateFunction("min", t.dateTime64(3)),
		last_activity: t.simpleAggregateFunction("max", t.dateTime64(3)),
		pageviews: t.aggregateFunction("uniqExact", t.string()),
	},
});

export const analyticsSessionsMv = defineMaterializedView("analytics_sessions_mv", {
	datasource: analyticsSessions,
	nodes: [
		node({
			name: "sessions",
			sql: `SELECT toDate(timestamp) AS day, ${Object.keys(trafficDimensions).join(", ")},
			uniqExactStateIf(event_id, action = 'page_view') AS pageviews,
			uniqExactStateIf(event_id, action IN ('link_click', 'outbound_click', 'contact_submission')) AS conversions,
			min(timestamp) AS first_activity, max(timestamp) AS last_activity
			FROM analytics_events WHERE action NOT IN ('web_vital', 'engagement')
			GROUP BY day, ${Object.keys(trafficDimensions).join(", ")}`,
		}),
	],
});

export const analyticsVitals = defineDatasource("analytics_vitals", {
	engine: engine.aggregatingMergeTree({
		partitionKey: "toYYYYMM(day)",
		sortingKey: [
			"organization_id",
			"website_id",
			"day",
			...Object.keys(dimensions)
				.sort()
				.filter((key) => !["organization_id", "website_id"].includes(key)),
			"metric",
			"metric_id",
		],
		ttl: "day + INTERVAL 13 MONTH",
	}),
	jsonPaths: false,
	schema: {
		day: t.date(),
		...dimensions,
		metric: t.string().lowCardinality(),
		metric_id: t.string(),
		value: t.aggregateFunction("argMax", t.float64(), t.float64()),
	},
});

export const analyticsVitalsMv = defineMaterializedView("analytics_vitals_mv", {
	datasource: analyticsVitals,
	nodes: [
		node({
			name: "vitals",
			sql: `SELECT toDate(timestamp) AS day, ${Object.keys(dimensions).join(", ")}, metric, metric_id,
			argMaxState(metric_value, metric_sequence) AS value
			FROM analytics_events WHERE action = 'web_vital'
			GROUP BY day, ${Object.keys(dimensions).join(", ")}, metric, metric_id`,
		}),
	],
});

const audienceDimensions = {
	...dimensions,
	city: t.string(),
	country: t.string().lowCardinality(),
	os: t.string().lowCardinality(),
};

export const analyticsAudience = defineDatasource("analytics_audience", {
	engine: rollupEngine(Object.keys(audienceDimensions)),
	jsonPaths: false,
	schema: {
		day: t.date(),
		...audienceDimensions,
		engaged_time: t.simpleAggregateFunction("sum", t.float64()),
		pageviews: t.aggregateFunction("uniqExact", t.string()),
		visitors: t.aggregateFunction("uniqExact", t.string()),
		visits: t.aggregateFunction("uniqExact", t.string()),
	},
});

export const analyticsAudienceMv = defineMaterializedView("analytics_audience_mv", {
	datasource: analyticsAudience,
	nodes: [
		node({
			name: "audience",
			sql: `SELECT toDate(timestamp) AS day, ${Object.keys(audienceDimensions).join(", ")},
			sumIf(engaged_time, action = 'engagement') AS engaged_time,
			uniqExactStateIf(event_id, action = 'page_view') AS pageviews,
			uniqExactStateIf(visitor_id, action = 'page_view') AS visitors,
			uniqExactStateIf(session_id, action = 'page_view') AS visits
			FROM analytics_events WHERE action != 'web_vital'
			GROUP BY day, ${Object.keys(audienceDimensions).join(", ")}`,
		}),
	],
});

export type AnalyticsEventRow = InferRow<typeof analyticsEvents>;
