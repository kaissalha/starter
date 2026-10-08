import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { requireOrganizationPermission } from "../../services/permissions";
import { getSeoOverview, seoOverviewSchema } from "../../services/seo/overview";
import {
	exploreSeoPrompt,
	geoOverviewInputSchema,
	geoOverviewSchema,
	geoRefreshInputSchema,
	getGeoOverview,
	refreshGeoQuestion,
	seoPromptInputSchema,
	seoPromptResultSchema,
} from "../../services/seo/prompt-explorer";
import { getSearchConsoleOverview, searchConsoleOverviewSchema } from "../../services/seo/search-console";

export const registerSeoMcpTools = ({
	organizationId,
	server,
	userId,
}: {
	organizationId: string;
	server: McpServer;
	userId: string;
}) => {
	const readAnnotations = { destructiveHint: false, openWorldHint: false, readOnlyHint: true };

	const checkAnnotations = {
		destructiveHint: false,
		idempotentHint: false,
		openWorldHint: true,
		readOnlyHint: false,
	};

	server.registerTool(
		"get_seo_overview",
		{
			annotations: readAnnotations,
			description:
				"Published website search readiness: page count, primary domain connection and per-page title, description and H1 issues by locale.",
			inputSchema: z.compile(z.object({})),
			outputSchema: seoOverviewSchema,
			title: "getSeoOverview",
		},
		async () => {
			const output = await getSeoOverview({ organizationId });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"get_search_console_overview",
		{
			annotations: { ...readAnnotations, openWorldHint: true },
			description:
				"Connected Google Search Console clicks, impressions and top queries for the primary domain over the latest 28 available days. Non-available statuses are not zeros.",
			inputSchema: z.compile(z.object({})),
			outputSchema: searchConsoleOverviewSchema,
			title: "getSearchConsoleOverview",
		},
		async () => {
			const output = await getSearchConsoleOverview({ organizationId, userId });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"get_geo_overview",
		{
			annotations: readAnnotations,
			description:
				"Tracked location-scoped customer questions with the latest sampled AI answers, brand mentions, sources and history. Read-only: returns no samples until a question is tracked with explore_seo_prompt or the dashboard GEO page.",
			inputSchema: geoOverviewInputSchema,
			outputSchema: geoOverviewSchema,
			title: "getGeoOverview",
		},
		async (input) => {
			const output = await getGeoOverview({ ...input, organizationId });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"explore_seo_prompt",
		{
			annotations: checkAnnotations,
			description:
				"Ask sampled AI models one customer question and report whether each answer mentions the business. Saves the question to GEO tracking; rate limited.",
			inputSchema: seoPromptInputSchema,
			outputSchema: seoPromptResultSchema,
			title: "exploreSeoPrompt",
		},
		async (input, { mcpReq: { signal } }) => {
			await requireOrganizationPermission({ organizationId, permission: "write", userId });
			const output = await exploreSeoPrompt({ ...input, organizationId, signal });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
	server.registerTool(
		"refresh_geo_question",
		{
			annotations: checkAnnotations,
			description:
				"Re-run one tracked question by ID from get_geo_overview. Mode sample asks models directly; web grounds answers in live web sources. Rate limited.",
			inputSchema: geoRefreshInputSchema,
			outputSchema: seoPromptResultSchema,
			title: "refreshGeoQuestion",
		},
		async (input, { mcpReq: { signal } }) => {
			await requireOrganizationPermission({ organizationId, permission: "write", userId });
			const output = await refreshGeoQuestion({ ...input, organizationId, signal });

			return { content: [{ text: JSON.stringify(output), type: "text" }], structuredContent: output };
		}
	);
};
