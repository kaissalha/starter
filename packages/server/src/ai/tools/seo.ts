import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { requireOrganizationPermission } from "../../services/permissions";
import { getSeoOverview } from "../../services/seo/overview";
import {
	exploreSeoPrompt,
	geoOverviewInputSchema,
	geoRefreshInputSchema,
	getGeoOverview,
	refreshGeoQuestion,
	seoPromptInputSchema,
} from "../../services/seo/prompt-explorer";
import { getSearchConsoleOverview } from "../../services/seo/search-console";
import { appContextSchema, toolInput } from "../types";

export const seoTools = {
	exploreSeoPrompt: createTool({
		description:
			"Ask sampled AI models one customer question about the business and report whether each answer mentions it, with cited sources. Saves the question to GEO tracking and counts toward a rate limit.",
		execute: async (input, { abortSignal, requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });

			return exploreSeoPrompt({
				...input,
				organizationId: requestContext.all.organizationId,
				signal: abortSignal,
			});
		},
		id: "explore-seo-prompt",
		inputSchema: toolInput(seoPromptInputSchema),
		requestContextSchema: appContextSchema,
	}),
	getGeoOverview: createTool({
		description:
			"Read tracked location-scoped customer questions for one locale with the latest sampled AI answers, brand mentions and check history.",
		execute: async (input, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "read" });

			return getGeoOverview({ ...input, organizationId: requestContext.all.organizationId });
		},
		id: "get-geo-overview",
		inputSchema: toolInput(geoOverviewInputSchema),
		requestContextSchema: appContextSchema,
	}),
	getSearchConsoleOverview: createTool({
		description:
			"Read the current user's connected Google Search Console clicks, impressions and top queries for the primary domain over the latest 28 available days.",
		execute: async (_input, { requestContext }) => getSearchConsoleOverview(requestContext.all),
		id: "get-search-console-overview",
		inputSchema: z.compile(z.object({})),
		requestContextSchema: appContextSchema,
	}),
	getSeoOverview: createTool({
		description:
			"Read published website search readiness: page count, primary domain connection and per-page title, description and H1 issues.",
		execute: async (_input, { requestContext }) => getSeoOverview(requestContext.all),
		id: "get-seo-overview",
		inputSchema: z.compile(z.object({})),
		requestContextSchema: appContextSchema,
	}),
	refreshGeoQuestion: createTool({
		description:
			"Re-run one tracked GEO question by exact ID from getGeoOverview. Mode sample asks models directly; web grounds answers in live web sources. Counts toward a rate limit.",
		execute: async (input, { abortSignal, requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });

			return refreshGeoQuestion({
				...input,
				organizationId: requestContext.all.organizationId,
				signal: abortSignal,
			});
		},
		id: "refresh-geo-question",
		inputSchema: toolInput(geoRefreshInputSchema),
		requestContextSchema: appContextSchema,
	}),
};
