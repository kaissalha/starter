import { openapi } from "@orpc/openapi";
import { z } from "zod";

import { getSeoOverview, seoOverviewSchema } from "../../services/seo/overview";
import {
	exploreSeoPrompt,
	getGeoOverview,
	geoOverviewInputSchema,
	geoOverviewSchema,
	geoRefreshInputSchema,
	refreshGeoQuestion,
	seedGeoOverview,
	SeoBusinessRequiredError,
	SeoPromptLimitError,
	seoPromptInputSchema,
	seoPromptResultSchema,
	SeoSourcesUnavailableError,
} from "../../services/seo/prompt-explorer";
import { getSearchConsoleOverview, searchConsoleOverviewSchema } from "../../services/seo/search-console";
import { authedWithOrganization, organizationPermission, publicApi } from "../base";

const procedure = authedWithOrganization.meta(publicApi(true));

const writeProcedure = procedure.use(organizationPermission("write"));

export const seo = {
	explorePrompt: writeProcedure
		.meta(
			openapi({
				method: "POST",
				operationId: "exploreSeoPrompt",
				path: "/seo/prompt-explorer",
				summary: "Compare sample AI answers to a customer question",
				tags: ["seo"],
			})
		)
		.errors({
			NOT_FOUND: { message: "Create a website before comparing AI answers." },
			TOO_MANY_REQUESTS: { message: "AI answer exploration limit reached. Try again later." },
		})
		.input(seoPromptInputSchema)
		.output(seoPromptResultSchema)
		.handler(async ({ context, errors, input, signal }) => {
			try {
				return await exploreSeoPrompt({ ...input, organizationId: context.organizationId, signal });
			} catch (error) {
				if (error instanceof SeoBusinessRequiredError) {
					throw errors.NOT_FOUND();
				}

				if (error instanceof SeoPromptLimitError) {
					throw errors.TOO_MANY_REQUESTS();
				}

				throw error;
			}
		}),
	geoOverview: procedure
		.meta(
			openapi({
				method: "GET",
				operationId: "getGeoOverview",
				path: "/seo/geo-overview",
				summary: "Location-scoped customer questions and sampled AI answers",
				tags: ["seo"],
			})
		)
		.input(geoOverviewInputSchema)
		.output(geoOverviewSchema)
		.handler(({ context, input }) => getGeoOverview({ ...input, organizationId: context.organizationId })),
	overview: procedure
		.meta(
			openapi({
				method: "GET",
				operationId: "getSeoOverview",
				path: "/seo/overview",
				summary: "Published website search readiness",
				tags: ["seo"],
			})
		)
		.input(z.undefined())
		.output(seoOverviewSchema)
		.handler(({ context }) => getSeoOverview({ organizationId: context.organizationId })),
	refreshGeoQuestion: writeProcedure
		.meta(
			openapi({
				method: "POST",
				operationId: "refreshGeoQuestion",
				path: "/seo/geo-questions/{questionId}/refresh",
				summary: "Run a new location-scoped AI answer check",
				tags: ["seo"],
			})
		)
		.errors({
			NOT_FOUND: { message: "Question not found." },
			SERVICE_UNAVAILABLE: { message: "Web sources are unavailable right now." },
			TOO_MANY_REQUESTS: { message: "AI answer exploration limit reached. Try again later." },
		})
		.input(geoRefreshInputSchema)
		.output(seoPromptResultSchema)
		.handler(async ({ context, errors, input, signal }) => {
			try {
				return await refreshGeoQuestion({ ...input, organizationId: context.organizationId, signal });
			} catch (error) {
				if (error instanceof SeoSourcesUnavailableError) {
					throw errors.SERVICE_UNAVAILABLE();
				}

				if (error instanceof SeoPromptLimitError) {
					throw errors.TOO_MANY_REQUESTS();
				}

				if (error instanceof SeoBusinessRequiredError) {
					throw errors.NOT_FOUND();
				}

				throw error;
			}
		}),
	searchConsole: procedure
		.meta(
			openapi({
				method: "GET",
				operationId: "getSearchConsoleOverview",
				path: "/seo/search-console",
				summary: "Read connected Google Search Console performance",
				tags: ["seo"],
			})
		)
		.input(z.undefined())
		.output(searchConsoleOverviewSchema)
		.handler(({ context }) =>
			getSearchConsoleOverview({ organizationId: context.organizationId, userId: context.session.user.id })
		),
	seedGeoOverview: authedWithOrganization
		.use(organizationPermission("write"))
		.meta(
			openapi({
				method: "POST",
				operationId: "seedGeoOverview",
				path: "/seo/geo-overview/seed",
				summary: "Create starter customer questions and sample AI answers",
				tags: ["seo"],
			})
		)
		.input(geoOverviewInputSchema)
		.output(geoOverviewSchema)
		.handler(({ context, input, signal }) =>
			seedGeoOverview({ ...input, organizationId: context.organizationId, signal })
		),
};
