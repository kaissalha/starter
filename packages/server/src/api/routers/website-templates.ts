import { openapi } from "@orpc/openapi";
import { z } from "zod";

import {
	websiteBriefSchema,
	websiteSnapshotSchema,
	websiteStateSchema,
	websiteTemplateChangeInputSchema,
} from "@starter/infinite-website/generation";

import { listWebsiteTemplateThemes, selectWebsiteGenerationTemplate } from "../../services/websites/generation";
import {
	WebsiteDraftNotFoundError,
	WebsiteGenerationConflictError,
	WebsiteMutationConflictError,
	WebsiteTemplateChangeTargetError,
	getWebsite,
	prepareWebsiteTemplateChangeStart,
} from "../../services/websites/service";
import { restyleWebsiteTemplate } from "../../services/websites/template-restyle";
import { startWebsiteGeneration } from "../../workflows/start";
import { organizationPermission, authedWithOrganization } from "../base";

const templates = authedWithOrganization
	.meta(
		openapi({
			method: "GET",
			operationId: "listWebsiteTemplates",
			path: "/websites/templates",
			summary: "List website templates",
			tags: ["websites"],
		})
	)
	.output(
		z.compile(
			z.array(
				z.strictObject({
					description: z.string().min(1),
					id: z.string().min(1),
					name: z.string().min(1),
					preview: websiteSnapshotSchema,
					tags: z.array(z.string().min(1)),
				})
			)
		)
	)
	.handler(async ({ context }) => {
		const website = await getWebsite({ organizationId: context.organizationId });
		const locale = website?.snapshot?.document.defaultLocale ?? "en";

		return listWebsiteTemplateThemes({ locale });
	});

const templateRecommendations = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "GET",
			operationId: "listWebsiteTemplateRecommendations",
			path: "/websites/templates/recommendations",
			summary: "List recommended website templates for the current website brief",
			tags: ["websites"],
		})
	)
	.output(
		z.compile(
			z
				.strictObject({ templateIds: z.array(z.string().min(1)) })
				.meta({ id: "WebsiteTemplateRecommendationsResponse" })
		)
	)
	.handler(async ({ context, signal }) => {
		const website = await getWebsite({ organizationId: context.organizationId });

		return {
			templateIds: website
				? (await selectWebsiteGenerationTemplate({ abortSignal: signal, brief: website.brief })).templateIds
				: [],
		};
	});

const recommendTemplate = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "recommendWebsiteTemplate",
			path: "/websites/templates/recommendation",
			summary: "Recommend a website template for a business brief",
			tags: ["websites"],
		})
	)
	.input(z.compile(websiteBriefSchema.omit({ schemaVersion: true }).meta({ id: "RecommendWebsiteTemplateInput" })))
	.output(
		z.compile(
			z
				.strictObject({ templateId: z.string().min(1), templateName: z.string().min(1) })
				.meta({ id: "RecommendWebsiteTemplateResponse" })
		)
	)
	.handler(async ({ input, signal }) => {
		const { templateId, templateName } = await selectWebsiteGenerationTemplate({
			abortSignal: signal,
			brief: { ...input, schemaVersion: 1 },
		});

		return { templateId, templateName };
	});

const restyleTemplate = authedWithOrganization
	.use(organizationPermission("delete"))
	.meta(
		openapi({
			method: "POST",
			operationId: "restyleWebsiteTemplate",
			path: "/websites/{websiteId}/restyle",
			summary: "Apply compatible template styling while preserving all website content",
			tags: ["websites"],
		})
	)
	.errors({
		CONFLICT: { message: "The website changed or has an active operation." },
		INVALID_TEMPLATE: { message: "The requested template is unavailable." },
		NOT_FOUND: { message: "The website draft was not found." },
	})
	.input(
		z.compile(
			z
				.strictObject({ templateId: z.string().min(1), updatedAt: z.string(), websiteId: z.uuid() })
				.meta({ id: "RestyleWebsiteTemplateInput" })
		)
	)
	.output(websiteStateSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			return await restyleWebsiteTemplate({ organizationId: context.organizationId, ...input });
		} catch (error) {
			if (error instanceof WebsiteTemplateChangeTargetError) {
				throw errors.INVALID_TEMPLATE();
			}

			if (error instanceof WebsiteMutationConflictError) {
				throw errors.CONFLICT();
			}

			if (error instanceof WebsiteDraftNotFoundError) {
				throw errors.NOT_FOUND();
			}

			throw error;
		}
	});

const changeTemplate = authedWithOrganization
	.use(organizationPermission("delete"))
	.meta(
		openapi({
			method: "POST",
			operationId: "changeWebsiteTemplate",
			path: "/websites/{websiteId}/template",
			successStatus: 202,
			summary: "Regenerate the website with a selected template",
			tags: ["websites"],
		})
	)
	.errors({
		CONFLICT: { message: "This website already has an active operation or changed elsewhere." },
		GENERATION_FAILED: { message: "Template generation could not be started." },
		INVALID_TEMPLATE: { message: "The requested template is unavailable." },
		NOT_FOUND: { message: "The website was not found." },
	})
	.input(
		z.compile(
			websiteTemplateChangeInputSchema
				.omit({ schemaVersion: true })
				.extend({ updatedAt: z.string(), websiteId: z.uuid() })
				.meta({ id: "ChangeWebsiteTemplateInput" })
		)
	)
	.output(
		z.compile(
			z
				.strictObject({ websiteId: z.uuid(), workflowRunId: z.string().min(1) })
				.meta({ id: "ChangeWebsiteTemplateResponse" })
		)
	)
	.handler(async ({ context, errors, input }) => {
		const prepared = await (async () => {
			try {
				return await prepareWebsiteTemplateChangeStart({
					input: { schemaVersion: 1, templateId: input.templateId },
					organizationId: context.organizationId,
					websiteId: input.websiteId,
				});
			} catch (error) {
				if (error instanceof WebsiteGenerationConflictError) {
					throw errors.CONFLICT();
				}

				if (error instanceof WebsiteTemplateChangeTargetError) {
					throw errors.INVALID_TEMPLATE();
				}

				throw error;
			}
		})();

		if (prepared.record.updatedAt !== input.updatedAt) {
			throw errors.CONFLICT();
		}

		try {
			return await startWebsiteGeneration({
				brief: prepared.brief,
				expectedRunId: prepared.expectedRunId,
				expectedUpdatedAt: input.updatedAt,
				organizationId: context.organizationId,
				templateId: prepared.input.templateId,
				websiteId: input.websiteId,
			});
		} catch (error) {
			if (error instanceof WebsiteGenerationConflictError) {
				throw errors.CONFLICT();
			}

			throw errors.GENERATION_FAILED();
		}
	});

export const websiteTemplates = {
	changeTemplate,
	recommendTemplate,
	restyleTemplate,
	templateRecommendations,
	templates,
};
