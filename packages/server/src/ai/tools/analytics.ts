import { createTool } from "@mastra/core/tools";

import { analyticsBreakdownInputSchema, analyticsFiltersSchema } from "@starter/analytics";

import {
	getAnalyticsBreakdown,
	getAnalyticsLive,
	getAnalyticsOverview,
	getAnalyticsRealtime,
	getAnalyticsWebVitals,
} from "../../services/analytics";
import { appContextSchema, toolInput } from "../types";

export const analyticsTools = {
	getAnalyticsBreakdown: createTool({
		description:
			"Read bounded, paginated traffic breakdowns by pages, sources, AI referrers, campaigns, countries, devices, browsers or Links destinations. Use hasMore to paginate.",
		execute: async (input, { requestContext }) => getAnalyticsBreakdown({ actor: requestContext.all, input }),
		id: "get-analytics-breakdown",
		inputSchema: toolInput(analyticsBreakdownInputSchema),
		requestContextSchema: appContextSchema,
	}),
	getAnalyticsLive: createTool({
		description:
			"Read visitors active in the last five minutes with their current page and approximate location. Surface, domain and locale filters apply; date filters do not change this live window.",
		execute: async (input, { requestContext }) => getAnalyticsLive({ actor: requestContext.all, input }),
		id: "get-analytics-live",
		inputSchema: toolInput(analyticsFiltersSchema),
		requestContextSchema: appContextSchema,
	}),
	getAnalyticsOverview: createTool({
		description:
			"Read traffic totals, previous-period comparisons and daily trends for the active organization. Dates are inclusive UTC, last 30 days by default, at most 13 months.",
		execute: async (input, { requestContext }) => getAnalyticsOverview({ actor: requestContext.all, input }),
		id: "get-analytics-overview",
		inputSchema: toolInput(analyticsFiltersSchema),
		requestContextSchema: appContextSchema,
	}),
	getAnalyticsRealtime: createTool({
		description:
			"Read distinct visitors with traffic activity in the last five minutes. Surface, domain and locale filters apply; date filters do not change this live window.",
		execute: async (input, { requestContext }) => getAnalyticsRealtime({ actor: requestContext.all, input }),
		id: "get-analytics-realtime",
		inputSchema: toolInput(analyticsFiltersSchema),
		requestContextSchema: appContextSchema,
	}),
	getAnalyticsWebVitals: createTool({
		description:
			"Read LCP, INP and CLS at p75, with sample counts for all devices and each device category. LCP/INP are milliseconds and CLS is unitless.",
		execute: async (input, { requestContext }) => getAnalyticsWebVitals({ actor: requestContext.all, input }),
		id: "get-analytics-web-vitals",
		inputSchema: toolInput(analyticsFiltersSchema),
		requestContextSchema: appContextSchema,
	}),
};
