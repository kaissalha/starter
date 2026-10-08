import { openapi } from "@orpc/openapi";
import { z } from "zod";

import {
	analyticsBreakdownInputSchema,
	analyticsBreakdownSchema,
	analyticsFiltersSchema,
	analyticsLiveSchema,
	analyticsOverviewSchema,
	analyticsRealtimeSchema,
	analyticsWebVitalsSchema,
} from "@starter/analytics";
import { AnalyticsUnavailableError } from "@starter/analytics/tinybird";

import {
	getAnalyticsBreakdown,
	getAnalyticsLive,
	getAnalyticsOverview,
	getAnalyticsRealtime,
	getAnalyticsWebVitals,
} from "../../services/analytics";
import { authedWithOrganization, publicApi } from "../base";

const procedure = authedWithOrganization
	.meta(publicApi(true))
	.errors({
		BAD_REQUEST: { message: "Invalid analytics filters." },
		FORBIDDEN: { message: "Organization membership is required." },
		SERVICE_UNAVAILABLE: { message: "Analytics is unavailable." },
	})
	.use(async ({ context, errors, next }) => {
		try {
			return await next({
				context: {
					analyticsActor: { organizationId: context.organizationId, userId: context.session.user.id },
				},
			});
		} catch (error) {
			if (error instanceof AnalyticsUnavailableError) {
				throw errors.SERVICE_UNAVAILABLE();
			}

			if (error instanceof RangeError) {
				throw errors.BAD_REQUEST({ message: error.message });
			}

			throw error;
		}
	});

export const analytics = {
	breakdown: procedure
		.meta(
			openapi({
				method: "GET",
				operationId: "getAnalyticsBreakdown",
				path: "/analytics/breakdowns",
				summary: "Traffic breakdowns",
				tags: ["analytics"],
			})
		)
		.input(z.compile(analyticsBreakdownInputSchema))
		.output(analyticsBreakdownSchema)
		.handler(({ context, input }) => getAnalyticsBreakdown({ actor: context.analyticsActor, input })),
	live: procedure
		.meta(
			openapi({
				method: "GET",
				operationId: "getAnalyticsLive",
				path: "/analytics/live",
				summary: "Visitors active within five minutes, with their current page and approximate location",
				tags: ["analytics"],
			})
		)
		.input(z.compile(analyticsFiltersSchema))
		.output(analyticsLiveSchema)
		.handler(({ context, input }) => getAnalyticsLive({ actor: context.analyticsActor, input })),
	overview: procedure
		.meta(
			openapi({
				method: "GET",
				operationId: "getAnalyticsOverview",
				path: "/analytics/overview",
				summary: "Traffic totals, previous period and daily trends",
				tags: ["analytics"],
			})
		)
		.input(z.compile(analyticsFiltersSchema))
		.output(analyticsOverviewSchema)
		.handler(({ context, input }) => getAnalyticsOverview({ actor: context.analyticsActor, input })),
	realtime: procedure
		.meta(
			openapi({
				method: "GET",
				operationId: "getAnalyticsRealtime",
				path: "/analytics/realtime",
				summary: "Visitors active within five minutes",
				tags: ["analytics"],
			})
		)
		.input(z.compile(analyticsFiltersSchema))
		.output(analyticsRealtimeSchema)
		.handler(({ context, input }) => getAnalyticsRealtime({ actor: context.analyticsActor, input })),
	webVitals: procedure
		.meta(
			openapi({
				method: "GET",
				operationId: "getAnalyticsWebVitals",
				path: "/analytics/web-vitals",
				summary: "Core Web Vitals p75 and sample counts by device",
				tags: ["analytics"],
			})
		)
		.input(z.compile(analyticsFiltersSchema))
		.output(analyticsWebVitalsSchema)
		.handler(({ context, input }) => getAnalyticsWebVitals({ actor: context.analyticsActor, input })),
};
