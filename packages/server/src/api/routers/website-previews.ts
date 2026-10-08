import { openapi } from "@orpc/openapi";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import {
	BehaviorSectionError,
	iso6391LanguageCodeSchema,
	websiteTextEditInputSchema,
	WebsiteEditError,
} from "@starter/infinite-website/editing";
import {
	websiteLayoutGenerationInputSchema,
	websiteSnapshotSchema,
	websiteGenerationProfiles,
	validateSiteDocument,
} from "@starter/infinite-website/generation";

import { websiteTextGenerationSchema } from "../../ai/prompts";
import { buildWebsiteToolContract, composeWebsiteSectionToolContract } from "../../ai/website-contracts";
import {
	parseContractInput,
	prepareBuildDraft,
	prepareComposeDraft,
	previewWebsiteDraft,
} from "../../ai/website-drafts";
import {
	createWebsiteHomepagePreviewSkeleton,
	generateWebsiteHomepagePreview,
} from "../../services/websites/homepage-preview";
import {
	generateWebsiteLayoutPreview,
	WebsiteLayoutGenerationInputError,
} from "../../services/websites/layout-generation";
import {
	recommendWebsiteSectionLayout,
	WebsiteSectionAdditionInputError,
} from "../../services/websites/section-catalog";
import { getWebsite, WebsiteMutationConflictError } from "../../services/websites/service";
import { prepareWebsiteTemplateRestyle } from "../../services/websites/template-restyle";
import { generateWebsiteText, WebsiteTextGenerationInputError } from "../../services/websites/text-generation";
import { authedWithOrganization, organizationPermission } from "../base";
import { getWebsiteSnapshot } from "../utils/website";

const previewLayout = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "previewWebsiteLayout",
			path: "/websites/{websiteId}/layout-preview",
			summary: "Generate missing text for a section layout preview",
			tags: ["websites"],
		})
	)
	.errors({
		INVALID_TARGET: { message: "The requested section, locale or layout is unavailable." },
		NOT_FOUND: { message: "The website was not found." },
	})
	.input(
		z.compile(
			websiteLayoutGenerationInputSchema
				.omit({ schemaVersion: true })
				.extend({
					locale: iso6391LanguageCodeSchema,

					snapshot: websiteSnapshotSchema,
					websiteId: z.uuid(),
				})
				.meta({ id: "PreviewWebsiteLayoutInput" })
		)
	)
	.output(websiteSnapshotSchema)
	.handler(async ({ context, errors, input, signal }) => {
		const website = await getWebsite({ organizationId: context.organizationId });

		if (!website || website.id !== input.websiteId) {
			throw errors.NOT_FOUND();
		}

		if (!input.snapshot.document.locales.includes(input.locale)) {
			throw errors.INVALID_TARGET();
		}

		const persisted = Boolean(website.snapshot) && isDeepStrictEqual(input.snapshot, website.snapshot);

		if (!persisted && !validateSiteDocument(input.snapshot.document).success) {
			throw errors.BAD_REQUEST({ message: "The website snapshot is invalid." });
		}

		try {
			return await generateWebsiteLayoutPreview({
				abortSignal: signal,
				brief: website.brief,
				input: { pattern: input.pattern, schemaVersion: 1, target: input.target },
				locale: input.locale,
				previewScope: persisted
					? { organizationId: context.organizationId, revision: website.updatedAt, websiteId: website.id }
					: undefined,
				snapshot: input.snapshot,
				websiteId: website.id,
			});
		} catch (error) {
			if (error instanceof WebsiteLayoutGenerationInputError) {
				throw errors.INVALID_TARGET();
			}

			throw error;
		}
	});

const regenerateText = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "regenerateWebsiteText",
			path: "/websites/{websiteId}/text-preview",
			summary: "Rewrite a single website text field",
			tags: ["websites"],
		})
	)
	.errors({
		INVALID_TARGET: { message: "The text field changed or is unavailable. Try again with the current text." },
		NOT_FOUND: { message: "The website was not found." },
	})
	.input(
		z.compile(
			websiteTextEditInputSchema
				.omit({ operation: true, pageId: true })
				.extend({ instruction: z.string().trim().max(1000), websiteId: z.uuid() })
				.meta({ id: "RegenerateWebsiteTextInput" })
		)
	)
	.output(websiteTextGenerationSchema)
	.handler(async ({ context, errors, input }) => {
		const { websiteId, ...textInput } = input;
		const website = await getWebsite({ organizationId: context.organizationId });

		if (!website?.snapshot || website.id !== websiteId) {
			throw errors.NOT_FOUND();
		}

		try {
			return await generateWebsiteText({ ...textInput, brief: website.brief, snapshot: website.snapshot });
		} catch (error) {
			if (error instanceof WebsiteTextGenerationInputError) {
				throw errors.INVALID_TARGET();
			}

			throw error;
		}
	});

const websiteTemplatePreviewInputSchema = z.compile(
	z
		.strictObject({
			locale: iso6391LanguageCodeSchema,
			mode: z.enum(["skeleton", "generated", "restyle"]),
			templateId: z.string().min(1),
			websiteId: z.uuid(),
		})
		.meta({ id: "PreviewWebsiteTemplateInput" })
);

const previewTemplate = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "previewWebsiteTemplate",
			path: "/websites/{websiteId}/template-preview",
			summary: "Generate a homepage preview for a website template",
			tags: ["websites"],
		})
	)
	.errors({
		INVALID_TEMPLATE: { message: "The requested template is unavailable." },
		NOT_FOUND: { message: "The website was not found." },
	})
	.input(websiteTemplatePreviewInputSchema)
	.output(websiteSnapshotSchema)
	.handler(async ({ context, errors, input, signal }) => {
		const { locale, mode, templateId, websiteId } = input;
		const website = await getWebsite({ organizationId: context.organizationId });

		if (!website || website.id !== websiteId) {
			throw errors.NOT_FOUND();
		}

		if (
			!websiteGenerationProfiles.some((profile) => profile.templateId === templateId) ||
			!website.snapshot?.document.locales.includes(locale)
		) {
			throw errors.INVALID_TEMPLATE();
		}

		const previewInput = {
			abortSignal: signal,
			brief: website.brief,
			existingAssets: Object.values(website.snapshot?.assets ?? {}),
			locale,
			previewScope: { organizationId: context.organizationId, revision: website.updatedAt, websiteId },
			snapshot: website.snapshot,
			templateId,
			websiteId,
		};

		if (mode === "restyle") {
			const restyled = prepareWebsiteTemplateRestyle({ snapshot: website.snapshot, templateId });

			if (!restyled) {
				throw errors.INVALID_TEMPLATE();
			}

			return restyled.snapshot;
		}

		if (mode === "skeleton") {
			return createWebsiteHomepagePreviewSkeleton(previewInput);
		}

		return generateWebsiteHomepagePreview(previewInput);
	});

const recommendLayout = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "recommendWebsiteLayout",
			path: "/websites/{websiteId}/layout-recommendation",
			summary: "Recommend a compatible layout for a website section",
			tags: ["websites"],
		})
	)
	.errors({
		INVALID_TARGET: { message: "The requested section is unavailable." },
		NOT_FOUND: { message: "The website was not found." },
	})
	.input(
		z.compile(
			z
				.strictObject({
					request: z.string().trim().min(1).max(2000),
					sectionId: z.uuid(),
					websiteId: z.uuid(),
				})
				.meta({ id: "RecommendWebsiteLayoutInput" })
		)
	)
	.output(z.compile(z.strictObject({ pattern: z.string().min(1).nullable() })))
	.handler(async ({ context, errors, input, signal }) => {
		const snapshot = await getWebsiteSnapshot({
			notFound: errors.NOT_FOUND,
			organizationId: context.organizationId,
			websiteId: input.websiteId,
		});

		try {
			return {
				pattern: await recommendWebsiteSectionLayout({
					abortSignal: signal,
					request: input.request,
					sectionId: input.sectionId,
					snapshot,
				}),
			};
		} catch (error) {
			if (error instanceof WebsiteSectionAdditionInputError) {
				throw errors.INVALID_TARGET();
			}

			throw error;
		}
	});

const previewSection = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "previewWebsiteSection",
			path: "/websites/section-draft-preview",
			summary: "Preview a proposed composed section among its neighbours",
			tags: ["websites"],
		})
	)
	.errors({ INVALID_DRAFT: { message: "The proposed section is invalid or the website changed." } })
	.input(
		z.compile(
			z
				.strictObject({
					input: z.looseObject({ revision: z.string().min(1) }),
					tool: z.enum(["buildWebsite", "composeWebsiteSection"]),
				})
				.meta({ id: "PreviewWebsiteSectionInput" })
		)
	)
	.output(z.compile(websiteSnapshotSchema.nullable()))
	.handler(async ({ context, errors, input }) => {
		try {
			const draft =
				input.tool === "composeWebsiteSection"
					? await prepareComposeDraft({
							input: await parseContractInput(composeWebsiteSectionToolContract.inputSchema, input.input),
							organizationId: context.organizationId,
						})
					: await prepareBuildDraft({
							input: await parseContractInput(buildWebsiteToolContract.inputSchema, input.input),
							organizationId: context.organizationId,
						});

			return draft.visual ? await previewWebsiteDraft(draft) : null;
		} catch (error) {
			if (
				error instanceof BehaviorSectionError ||
				error instanceof WebsiteEditError ||
				error instanceof WebsiteMutationConflictError
			) {
				throw errors.INVALID_DRAFT();
			}

			throw error;
		}
	});

export const websitePreviews = { previewLayout, previewSection, previewTemplate, recommendLayout, regenerateText };
