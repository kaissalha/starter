import { defineEndpoint, node, p, t, type InferOutputRow } from "@tinybirdco/sdk";

import { analyticsRead } from "./resources";

const filters = {
	date_from: p.date(),
	date_to: p.date(),
	domain: p.string().optional(""),
	locale: p.string().optional(""),
	organization_id: p.string(),
	surface: p.string().optional(""),
};

const scope = `organization_id = {{String(organization_id)}}
	AND ({{String(surface, '')}} = '' OR surface = {{String(surface, '')}})
	AND ({{String(domain, '')}} = '' OR domain = {{String(domain, '')}})
	AND ({{String(locale, '')}} = '' OR locale = {{String(locale, '')}})`;

const dates = "day >= {{Date(date_from)}} AND day <= {{Date(date_to)}}";

const tokens = [{ scope: "READ" as const, token: analyticsRead }];

const metrics = {
	bounce_rate: t.float64(),
	conversion_rate: t.float64(),
	conversions: t.uint64(),
	duration: t.float64(),
	engaged_time: t.float64(),
	new_visitors: t.uint64(),
	pageviews: t.uint64(),
	returning_visitors: t.uint64(),
	visitors: t.uint64(),
	visits: t.uint64(),
};

const sessionSql = (daily: boolean) => `SELECT
	if(day >= {{Date(date_from)}}, 'current', 'previous') AS period,
	${daily ? "toString(day)" : "''"} AS date, session_id, visitor_id,
	min(visitor_since) AS visitor_since, uniqExactMerge(pageviews) AS views,
	uniqExactMerge(conversions) AS event_conversions, min(first_activity) AS first_activity,
	max(last_activity) AS last_activity
	FROM filtered GROUP BY period, date, session_id, visitor_id`;

export const analyticsOverview = defineEndpoint("analytics_overview", {
	nodes: [
		node({
			name: "filtered",
			sql: `SELECT day, session_id, visitor_id, visitor_since, pageviews, conversions, first_activity, last_activity
			FROM analytics_sessions WHERE ${scope} AND day >= {{Date(previous_from)}} AND day <= {{Date(date_to)}}`,
		}),
		node({ name: "sessions", sql: `${sessionSql(false)} UNION ALL ${sessionSql(true)}` }),
		node({
			name: "engagement",
			sql: `SELECT if(day >= {{Date(date_from)}}, 'current', 'previous') AS period, '' AS date, sum(engaged_time) AS engaged
			FROM analytics_audience WHERE ${scope} AND day >= {{Date(previous_from)}} AND day <= {{Date(date_to)}} GROUP BY period
			UNION ALL SELECT 'current' AS period, toString(day) AS date, sum(engaged_time) AS engaged
			FROM analytics_audience WHERE ${scope} AND ${dates} GROUP BY date`,
		}),
		node({
			name: "metrics",
			sql: `SELECT period, date,
			uniqExactIf(visitor_id, views > 0) AS visitors,
			uniqExactIf(visitor_id, views > 0 AND toDate(visitor_since) >= toDate(if(period = 'current', {{Date(date_from)}}, {{Date(previous_from)}}))) AS new_visitors,
			uniqExactIf(visitor_id, views > 0 AND toDate(visitor_since) < toDate(if(period = 'current', {{Date(date_from)}}, {{Date(previous_from)}}))) AS returning_visitors,
			countIf(views > 0) AS visits, sum(views) AS pageviews, sum(event_conversions) AS conversions,
			if(visits = 0, 0, countIf(views = 1 AND event_conversions = 0) / visits) AS bounce_rate,
			if(visits = 0, 0, sumIf(dateDiff('millisecond', first_activity, last_activity) / 1000, views > 0) / visits) AS duration,
			if(visits = 0, 0, countIf(views > 0 AND event_conversions > 0) / visits) AS conversion_rate
			FROM sessions GROUP BY period, date`,
		}),
		node({
			name: "overview",
			sql: `SELECT metrics.*, if(metrics.visits = 0, 0, engagement.engaged / 1000 / metrics.visits) AS engaged_time
			FROM metrics LEFT JOIN engagement ON metrics.period = engagement.period AND metrics.date = engagement.date
			ORDER BY period, date`,
		}),
	],
	output: { date: t.string(), period: t.string(), ...metrics },
	params: { ...filters, previous_from: p.date() },
	tokens,
});

const dimension = "{{String(dimension)}}";

const breakdownColumns = "uniqExact(visitor_id) AS visitors, uniqExact(session_id) AS visits";

const source = "if(referrer != '', referrer, lower(campaign_source))";

const channel = `multiIf(
	ai_source != '' OR match(lower(campaign_source), 'chatgpt|openai|perplexity|claude|gemini|copilot'), 'ai',
	lower(campaign_medium) IN ('cpc', 'ppc', 'paid', 'paidsearch', 'paid_social', 'paidsocial', 'display', 'ads', 'cpm'), 'paid',
	lower(campaign_medium) IN ('email', 'e-mail', 'newsletter') OR match(${source}, '^(mail[.]google|outlook[.]live|mail[.]yahoo)[.]'), 'email',
	match(${source}, '(^|[.])(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|startpage|naver|qwant|search[.]brave)([.][a-z.]+)?$'), 'search',
	lower(campaign_medium) IN ('social', 'social-media', 'sm') OR ${source} = 't.co' OR match(${source}, '(^|[.])(facebook|fb|instagram|ig|twitter|x|linkedin|lnkd|tiktok|youtube|youtu|pinterest|reddit|threads|snapchat|whatsapp|telegram|bsky|mastodon)([.][a-z.]+)?$'), 'social',
	${source} = '', 'direct',
	referrer = '', 'campaigns',
	'referral')`;

const actionKind = `multiIf(
	destination = '', 'enquiries',
	destination = 'tel:', 'calls',
	destination = 'mailto:', 'emails',
	destination = 'sms:', 'messages',
	match(destination, '^https?://(wa[.]me|(api|web|chat)[.]whatsapp[.]com)(/|$)'), 'whatsapp',
	match(destination, '^https?://((www[.])?google[.][a-z.]+/maps|maps[.]google[.][a-z.]+|maps[.]app[.]goo[.]gl|goo[.]gl/maps|maps[.]apple[.]com|(www[.])?waze[.]com)'), 'directions',
	match(lower(destination), '[.](pdf|docx?|xlsx?|pptx?|csv|zip|txt)$'), 'downloads',
	match(destination, '^https?://([a-z0-9-]+[.])*(facebook|instagram|x|twitter|linkedin|tiktok|youtube|pinterest|threads)[.]com(/|$)'), 'social',
	'links')`;

const trafficKeys = {
	actions: actionKind,
	aiSources: "ai_source",
	browsers: "browser",
	campaigns: "campaign",
	channels: channel,
	countries: "country",
	devices: "device",
	domains: "domain",
	links: "destination",
	locales: "locale",
	pages: "pathname",
	sources: "referrer",
	utmMediums: "campaign_medium",
	utmSources: "campaign_source",
};

const dimensionList = (keys: Array<string>) => keys.map((key) => `'${key}'`).join(", ");

export const analyticsBreakdown = defineEndpoint("analytics_breakdown", {
	nodes: [
		node({
			name: "traffic",
			sql: `SELECT multiIf(${Object.entries(trafficKeys)
				.map(([key, value]) => `${dimension} = '${key}', ${value}`)
				.join(", ")}, '') AS key,
		${breakdownColumns}, uniqExactMerge(pageviews) AS pageviews, uniqExactMerge(conversions) AS conversions
		FROM analytics_sessions WHERE ${dimension} IN (${dimensionList(Object.keys(trafficKeys))}) AND ${scope} AND ${dates}
		AND (${dimension} != 'aiSources' OR ai_source != '')
		AND (${dimension} != 'links' OR destination != '')
		AND (${dimension} != 'actions' OR finalizeAggregation(analytics_sessions.conversions) > 0)
		GROUP BY key`,
		}),
		node({
			name: "audience",
			sql: `SELECT multiIf(${dimension} = 'os', os, city = '', '', concat(country, '|', city)) AS key,
		uniqExactMerge(visitors) AS visitors, uniqExactMerge(visits) AS visits,
		uniqExactMerge(pageviews) AS pageviews, toUInt64(0) AS conversions
		FROM analytics_audience WHERE ${dimension} IN ('os', 'cities') AND ${scope} AND ${dates}
		GROUP BY key HAVING pageviews > 0`,
		}),
		node({
			name: "page_sessions",
			sql: `SELECT session_id, any(visitor_id) AS visitor_id, argMin(pathname, first_seen) AS entry_page, argMax(pathname, last_seen) AS exit_page,
		sum(views) AS views, sum(actions) AS actions
		FROM (SELECT session_id, visitor_id, pathname, min(first_activity) AS first_seen, max(last_activity) AS last_seen,
			uniqExactMerge(pageviews) AS views, uniqExactMerge(conversions) AS actions
			FROM analytics_sessions WHERE ${dimension} IN ('entryPages', 'exitPages') AND ${scope} AND ${dates}
			GROUP BY session_id, visitor_id, pathname HAVING views > 0)
		GROUP BY session_id`,
		}),
		node({
			name: "page_flow",
			sql: `SELECT if(${dimension} = 'entryPages', entry_page, exit_page) AS key, uniqExact(visitor_id) AS visitors,
		count() AS visits, sum(views) AS pageviews, sum(actions) AS conversions
		FROM page_sessions GROUP BY key`,
		}),
		node({
			name: "breakdown",
			sql: `SELECT * FROM (SELECT * FROM traffic UNION ALL SELECT * FROM audience UNION ALL SELECT * FROM page_flow)
		ORDER BY multiIf(${dimension} IN ('links', 'actions'), conversions, ${dimension} = 'pages', pageviews,
			${dimension} IN ('entryPages', 'exitPages'), visits, visitors) DESC, key
		LIMIT {{Int32(limit, 20)}} OFFSET {{Int32(offset, 0)}}`,
		}),
	],
	output: {
		conversions: t.uint64(),
		key: t.string(),
		pageviews: t.uint64(),
		visitors: t.uint64(),
		visits: t.uint64(),
	},
	params: { ...filters, dimension: p.string(), limit: p.int32().optional(20), offset: p.int32().optional(0) },
	tokens,
});

export const analyticsHourly = defineEndpoint("analytics_hourly", {
	nodes: [
		node({
			name: "hourly",
			sql: `SELECT toHour(timestamp) AS hour,
		uniqExactIf(visitor_id, action = 'page_view') AS visitors, uniqExactIf(session_id, action = 'page_view') AS visits,
		uniqExactIf(event_id, action = 'page_view') AS pageviews,
		uniqExactIf(event_id, action IN ('link_click', 'outbound_click', 'contact_submission')) AS conversions
		FROM analytics_events WHERE ${scope} AND toDate(timestamp) = {{Date(date_from)}}
		AND action NOT IN ('web_vital', 'engagement') GROUP BY hour ORDER BY hour`,
		}),
	],
	output: {
		conversions: t.uint64(),
		hour: t.uint8(),
		pageviews: t.uint64(),
		visitors: t.uint64(),
		visits: t.uint64(),
	},
	params: filters,
	tokens,
});

export const analyticsLive = defineEndpoint("analytics_live", {
	nodes: [
		node({
			name: "live",
			sql: `SELECT toString(cityHash64(visitor_id)) AS key, argMax(pathname, timestamp) AS pathname,
		argMax(country, timestamp) AS country, argMax(city, timestamp) AS city,
		argMax(latitude, timestamp) AS latitude, argMax(longitude, timestamp) AS longitude,
		argMax(device, timestamp) AS device, argMax(browser, timestamp) AS browser, argMax(os, timestamp) AS os,
		argMin(referrer, timestamp) AS referrer, countIf(action = 'page_view') AS pageviews,
		formatDateTime(max(timestamp), '%Y-%m-%dT%H:%i:%SZ') AS last_seen
		FROM analytics_events WHERE ${scope} AND timestamp >= now() - INTERVAL 5 MINUTE AND timestamp <= now() + INTERVAL 1 MINUTE
		AND action NOT IN ('web_vital', 'engagement') GROUP BY visitor_id ORDER BY last_seen DESC LIMIT 100`,
		}),
	],
	output: {
		browser: t.string(),
		city: t.string(),
		country: t.string(),
		device: t.string(),
		key: t.string(),
		last_seen: t.string(),
		latitude: t.float32(),
		longitude: t.float32(),
		os: t.string(),
		pageviews: t.uint64(),
		pathname: t.string(),
		referrer: t.string(),
	},
	params: filters,
	tokens,
});

export const analyticsRealtime = defineEndpoint("analytics_realtime", {
	nodes: [
		node({
			name: "realtime",
			sql: `SELECT uniqExact(visitor_id) AS visitors
		FROM analytics_events WHERE ${scope} AND timestamp >= now() - INTERVAL 5 MINUTE
		AND timestamp <= now() AND action != 'web_vital'`,
		}),
	],
	output: { visitors: t.uint64() },
	params: filters,
	tokens,
});

export const analyticsWebVitals = defineEndpoint("analytics_web_vitals", {
	nodes: [
		node({
			name: "latest",
			sql: `SELECT day, metric, metric_id, device, argMaxMerge(value) AS value
			FROM analytics_vitals WHERE ${scope} AND ${dates} GROUP BY day, metric, metric_id, device`,
		}),
		node({
			name: "samples",
			sql: "SELECT metric, device, value FROM latest UNION ALL SELECT metric, 'all' AS device, value FROM latest",
		}),
		node({
			name: "percentiles",
			sql: "SELECT metric, device, quantileExact(0.75)(value) AS p75, count() AS samples FROM samples GROUP BY metric, device ORDER BY metric, device",
		}),
	],
	output: { device: t.string(), metric: t.string(), p75: t.float64(), samples: t.uint64() },
	params: filters,
	tokens,
});

export type AnalyticsOverviewRow = InferOutputRow<typeof analyticsOverview>;
