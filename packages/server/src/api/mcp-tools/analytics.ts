import type { McpServer } from "@modelcontextprotocol/server";

import {
	analyticsBreakdownInputSchema,
	analyticsBreakdownSchema,
	analyticsFiltersSchema,
	analyticsLiveSchema,
	analyticsOverviewSchema,
	analyticsRealtimeSchema,
	analyticsWebVitalsSchema,
} from "@starter/analytics";

import {
	getAnalyticsBreakdown,
	getAnalyticsLive,
	getAnalyticsOverview,
	getAnalyticsRealtime,
	getAnalyticsWebVitals,
} from "../../services/analytics";

export const registerAnalyticsMcpTools = ({
	organizationId,
	server,
	userId,
}: {
	organizationId: string;
	server: McpServer;
	userId: string;
}) => {
	const actor = { organizationId, userId };
	const annotations = { destructiveHint: false, openWorldHint: false, readOnlyHint: true };
	server.registerTool(
		"get_analytics_overview",
		{
			annotations,
			description:
				"Traffic totals, previous-period comparisons and trends. Inclusive UTC dates; last 30 days by default, at most 13 months.",
			inputSchema: analyticsFiltersSchema,
			outputSchema: analyticsOverviewSchema,
			title: "getAnalyticsOverview",
		},
		async (input) => {
			const output = await getAnalyticsOverview({ actor, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"get_analytics_breakdown",
		{
			annotations,
			description:
				"Paginated pages, sources, AI referrers, campaigns, countries, devices, browsers and Links destinations. Follow hasMore.",
			inputSchema: analyticsBreakdownInputSchema,
			outputSchema: analyticsBreakdownSchema,
			title: "getAnalyticsBreakdown",
		},
		async (input) => {
			const output = await getAnalyticsBreakdown({ actor, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"get_analytics_realtime",
		{
			annotations,
			description: "Distinct visitors active in the last five minutes, filtered by surface, domain and locale.",
			inputSchema: analyticsFiltersSchema,
			outputSchema: analyticsRealtimeSchema,
			title: "getAnalyticsRealtime",
		},
		async (input) => {
			const output = await getAnalyticsRealtime({ actor, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"get_analytics_live",
		{
			annotations,
			description:
				"Visitors active in the last five minutes with their current page and approximate location, filtered by surface, domain and locale.",
			inputSchema: analyticsFiltersSchema,
			outputSchema: analyticsLiveSchema,
			title: "getAnalyticsLive",
		},
		async (input) => {
			const output = await getAnalyticsLive({ actor, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"get_analytics_web_vitals",
		{
			annotations,
			description:
				"LCP and INP in milliseconds and unitless CLS at p75, with sample counts by device. Missing samples are not zero.",
			inputSchema: analyticsFiltersSchema,
			outputSchema: analyticsWebVitalsSchema,
			title: "getAnalyticsWebVitals",
		},
		async (input) => {
			const output = await getAnalyticsWebVitals({ actor, input });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
};
