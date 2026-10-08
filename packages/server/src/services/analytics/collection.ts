import { ipAddress } from "@vercel/functions";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { AnalyticsContactContext, AnalyticsEvent } from "@starter/analytics";
import { createAnalyticsClient, getAnalyticsConfiguration, type AnalyticsEventRow } from "@starter/analytics/tinybird";
import { checkRateLimit } from "@starter/cache";
import { db, websites } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";

type CollectedEvent = AnalyticsEvent | (Omit<AnalyticsEvent, "action"> & { action: "contact_submission" });

export type AnalyticsTarget = {
	contentId: string;
	links: Array<{ id: string; url: string }>;
	locale: string;
	path: string;
	sectionIds: Array<string>;
	surface: "website" | "links" | "blog";
};

export type AnalyticsRequestContext = {
	browser: string;
	city: string;
	country: string;
	device: string;
	domain: string;
	latitude: number;
	longitude: number;
	os: string;
	websiteId: string;
};

const aiReferrers = [
	"chatgpt.com",
	"chat.openai.com",
	"perplexity.ai",
	"claude.ai",
	"gemini.google.com",
	"copilot.microsoft.com",
	"grok.com",
];

export const analyticsReferrer = (value: string) => {
	try {
		const url = new URL(value);

		return ["http:", "https:"].includes(url.protocol) ? url.hostname.toLowerCase() : "";
	} catch {
		return "";
	}
};

const destinationLabel = (value: string) => {
	const scheme = ["mailto:", "tel:", "sms:"].find((prefix) => value.toLowerCase().startsWith(prefix));

	if (scheme) {
		return scheme;
	}

	if (!value || !URL.canParse(value, "https://relative.invalid")) {
		return "";
	}

	const url = new URL(value, "https://relative.invalid");

	if (!["http:", "https:"].includes(url.protocol)) {
		return "";
	}

	return `${url.hostname === "relative.invalid" ? "" : url.origin}${url.pathname}`;
};

export const createAnalyticsRow = ({
	context,
	event,
	now = Date.now(),
	organizationId,
	target,
}: {
	context: AnalyticsRequestContext;
	event: CollectedEvent;
	now?: number;
	organizationId: string;
	target: AnalyticsTarget;
}): AnalyticsEventRow | null => {
	const timestamp = Date.parse(event.timestamp);
	const since = Date.parse(event.visitorSince);

	if (
		timestamp > now + 60_000 ||
		timestamp < now - 86_400_000 ||
		since > timestamp + 60_000 ||
		since < now - 366 * 86_400_000
	) {
		return null;
	}

	const link = event.action === "link_click" ? target.links.find(({ id }) => id === event.linkId) : null;
	const destination = destinationLabel(link?.url ?? (event.action === "outbound_click" ? event.href : ""));

	if ((event.action === "link_click" && !link) || (event.action === "outbound_click" && !destination)) {
		return null;
	}

	const referrer = analyticsReferrer(event.referrer);

	return {
		action: event.action,
		ai_source: aiReferrers.find((domain) => referrer === domain || referrer.endsWith(`.${domain}`)) ?? "",
		browser: context.browser,
		campaign: event.campaign.name,
		campaign_content: event.campaign.content,
		campaign_medium: event.campaign.medium,
		campaign_source: event.campaign.source,
		campaign_term: event.campaign.term,
		city: context.city,
		content_id: target.contentId,
		country: /^[A-Z]{2}$/u.test(context.country) ? context.country : "",
		destination,
		device: context.device,
		domain: context.domain,
		engaged_time: event.action === "engagement" ? event.engagedTime : 0,
		event_id: event.id,
		latitude: context.latitude,
		link_id: link?.id ?? "",
		locale: target.locale,
		longitude: context.longitude,
		metric: event.action === "web_vital" ? event.metric : "",
		metric_id: event.action === "web_vital" ? event.metricId : "",
		metric_sequence: event.action === "web_vital" ? event.sequence : 0,
		metric_value: event.action === "web_vital" ? event.value : 0,
		organization_id: organizationId,
		os: context.os,
		pathname: target.path,
		referrer: referrer === context.domain ? "" : referrer,
		session_id: event.sessionId,
		surface: target.surface,
		timestamp: event.timestamp,
		visitor_id: event.visitorId,
		visitor_since: event.visitorSince,
		website_id: context.websiteId,
	};
};

export const collectAnalytics = async ({
	context,
	events,
}: {
	context: AnalyticsRequestContext;
	events: Array<{ event: CollectedEvent; target: AnalyticsTarget }>;
}) => {
	if (!getAnalyticsConfiguration("append")) {
		return false;
	}

	try {
		const [website] = await db
			.select({ organizationId: websites.organizationId })
			.from(websites)
			.where(eq(websites.id, context.websiteId))
			.limit(1);

		if (!website) {
			return false;
		}

		const rows = events.flatMap(({ event, target }) => {
			const row = createAnalyticsRow({ context, event, organizationId: website.organizationId, target });

			return row ? [row] : [];
		});

		if (!rows.length) {
			return true;
		}

		const result = await createAnalyticsClient("append").analyticsEvents.ingestBatch(rows, {
			maxRetries: 1,
			wait: true,
		});

		if (result.quarantined_rows > 0) {
			throw new Error("Analytics rows were quarantined.");
		}

		return true;
	} catch (error) {
		await log.error({
			error: serializeLogError(error),
			message: "Analytics ingestion failed",
			websiteId: context.websiteId,
		});

		return false;
	}
};

export const recordAnalyticsContact = ({
	context,
	identity,
	sectionId,
	target,
}: {
	context: AnalyticsRequestContext;
	identity: AnalyticsContactContext;
	sectionId: string;
	target: AnalyticsTarget;
}) => {
	if (!target.sectionIds.includes(sectionId)) {
		return Promise.resolve(false);
	}

	return collectAnalytics({
		context,
		events: [
			{
				event: {
					...identity,
					action: "contact_submission",
					campaign: { content: "", medium: "", name: "", source: "", term: "" },
					id: randomUUID(),
					referrer: "",
					timestamp: new Date().toISOString(),
				},
				target,
			},
		],
	});
};

export const checkAnalyticsRateLimit = async ({ headers, websiteId }: { headers: Headers; websiteId: string }) => {
	const ip = ipAddress(headers);

	return ip
		? checkRateLimit({ key: `analytics:${websiteId}:${ip}`, max: 300, windowSeconds: 60 })
		: { allowed: true, retryAfterSeconds: 0 };
};
