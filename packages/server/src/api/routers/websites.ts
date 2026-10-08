import { openapi } from "@orpc/openapi";
import { eventIterator } from "@orpc/server";
import { v5 as uuidv5 } from "uuid";
import { z } from "zod";

import { websiteEditInputSchema, WebsiteEditError } from "@starter/infinite-website/editing";
import {
	createWebsiteSectionPreviewDocument,
	assetMapSchema,
	siteDocumentSchema,
	websiteBriefSchema,
	websiteGenerationEnvelopeSchema,
	websiteGenerationSectionCategories,
	websiteLayoutGenerationInputSchema,
	websiteSectionAdditionInputSchema,
	websiteStateSchema,
} from "@starter/infinite-website/generation";

import { convertChatMessagesForUI, getChatWithMessages } from "../../services/chat";
import { reviewWebsiteBrief, WebsiteBriefImplausibleError } from "../../services/websites/brief-review";
import { WebsiteTextTranslationError } from "../../services/websites/edit-preparation";
import { requireWebsiteEditPermission } from "../../services/websites/permissions";
import { createWebsiteSectionCatalogPreview } from "../../services/websites/section-addition";
import {
	listWebsiteSectionCatalog,
	recommendWebsiteSectionPattern,
	WebsiteSectionAdditionInputError,
} from "../../services/websites/section-catalog";
import {
	WebsiteGenerationConflictError,
	WebsiteDraftNotFoundError,
	WebsiteMutationConflictError,
	cancelWebsiteWorkflow,
	editWebsite,
	getWebsite,
	getWebsiteRecord,
	prepareWebsiteGenerationStart,
	prepareWebsiteLayoutGenerationStart,
	prepareWebsiteSectionAdditionStart,
	publishWebsite,
	unpublishWebsite,
} from "../../services/websites/service";
import { streamWebsiteWorkflow } from "../../services/websites/workflow-stream";
import {
	startWebsiteGeneration,
	startWebsiteLayoutGeneration,
	startWebsiteSectionAddition,
	translateWebsite,
} from "../../workflows/start";
import { organizationPermission, authedWithOrganization } from "../base";
import { getWebsiteSnapshot, startWebsiteModification } from "../utils/website";
import { websitePreviews } from "./website-previews";
import { websiteTemplates } from "./website-templates";

const websiteAgentChatNamespace = uuidv5("starter:website-agent-chat", uuidv5.URL);

const createWebsiteAgentChatId = ({ userId, websiteId }: { userId: string; websiteId: string }) =>
	uuidv5(JSON.stringify([userId, websiteId]), websiteAgentChatNamespace);

const get = authedWithOrganization
	.meta(
		openapi({
			method: "GET",
			operationId: "getCurrentWebsite",
			path: "/websites/current",
			summary: "Get the current organization website",
			tags: ["websites"],
		})
	)
	.output(websiteStateSchema.nullable())
	.handler(async ({ context }) => getWebsite({ organizationId: context.organizationId }));

const agentChat = authedWithOrganization
	.meta(
		openapi({
			method: "GET",
			operationId: "getCurrentWebsiteAgentChat",
			path: "/websites/current/agent-chat",
			summary: "Get the caller's agent chat history for the current organization website",
			tags: ["websites"],
		})
	)
	.handler(async ({ context }) => {
		const website = await getWebsite({ organizationId: context.organizationId });

		if (!website) {
			return null;
		}

		const chatId = createWebsiteAgentChatId({ userId: context.session.user.id, websiteId: website.id });

		const chat = await getChatWithMessages({
			chatId,
			organizationId: context.organizationId,
		});

		return { chatId, messages: chat ? await convertChatMessagesForUI(chat.messages) : [] };
	});

const generate = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "generateWebsite",
			path: "/websites",
			successStatus: 202,
			summary: "Generate the organization website",
			tags: ["websites"],
		})
	)
	.errors({
		CONFLICT: { message: "This organization already has a website or an active generation." },
		GENERATION_FAILED: { message: "Website generation could not be started." },
		IMPLAUSIBLE_BRIEF: { message: "The business description needs to be clearer before generating a website." },
	})
	.input(
		z.compile(
			z
				.strictObject({
					brief: websiteBriefSchema,
				})
				.meta({ id: "GenerateWebsiteInput" })
		)
	)
	.output(
		z.compile(
			z
				.strictObject({ websiteId: z.uuid(), workflowRunId: z.string().min(1) })
				.meta({ id: "GenerateWebsiteResponse" })
		)
	)
	.handler(async ({ context, errors, input, signal }) => {
		try {
			await reviewWebsiteBrief({ abortSignal: signal, brief: input.brief });
		} catch (error) {
			if (error instanceof WebsiteBriefImplausibleError) {
				throw errors.IMPLAUSIBLE_BRIEF();
			}

			throw error;
		}

		const prepared = await (async () => {
			try {
				return await prepareWebsiteGenerationStart({
					organizationId: context.organizationId,
					...input,
				});
			} catch (error) {
				if (error instanceof WebsiteGenerationConflictError) {
					throw errors.CONFLICT();
				}

				throw error;
			}
		})();

		try {
			return await startWebsiteGeneration({
				brief: prepared.brief,
				expectedRunId: prepared.expectedRunId,
				organizationId: context.organizationId,
				websiteId: prepared.record.id,
			});
		} catch (error) {
			if (error instanceof WebsiteGenerationConflictError) {
				throw errors.CONFLICT();
			}

			throw errors.GENERATION_FAILED();
		}
	});

const addSection = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "addWebsiteSection",
			path: "/websites/{websiteId}/sections",
			successStatus: 202,
			summary: "Add a generated section to the organization website",
			tags: ["websites"],
		})
	)
	.errors({
		CONFLICT: { message: "This website already has an active operation." },
		GENERATION_FAILED: { message: "Section generation could not be started." },
		INVALID_TARGET: { message: "The requested page, insertion index, or pattern is unavailable." },
		NOT_FOUND: { message: "The website was not found." },
	})
	.input(
		z.compile(
			websiteSectionAdditionInputSchema
				.omit({ schemaVersion: true })
				.extend({ updatedAt: z.string(), websiteId: z.uuid() })
				.meta({ id: "AddWebsiteSectionInput" })
		)
	)
	.output(
		z.compile(
			z
				.strictObject({ websiteId: z.uuid(), workflowRunId: z.string().min(1) })
				.meta({ id: "AddWebsiteSectionResponse" })
		)
	)
	.handler(({ context, errors, input }) =>
		startWebsiteModification({
			errors,
			input: { index: input.index, pageId: input.pageId, pattern: input.pattern, schemaVersion: 1 },
			organizationId: context.organizationId,
			prepare: prepareWebsiteSectionAdditionStart,
			start: startWebsiteSectionAddition,
			updatedAt: input.updatedAt,
			websiteId: input.websiteId,
		})
	);

const generateLayout = authedWithOrganization
	.use(organizationPermission("delete"))
	.meta(
		openapi({
			method: "POST",
			operationId: "generateWebsiteLayout",
			path: "/websites/{websiteId}/layouts",
			successStatus: 202,
			summary: "Generate missing content for a selected website section layout",
			tags: ["websites"],
		})
	)
	.errors({
		CONFLICT: { message: "This website already has an active operation." },
		GENERATION_FAILED: { message: "Layout generation could not be started." },
		INVALID_TARGET: { message: "The requested section or layout is unavailable." },
		NOT_FOUND: { message: "The website was not found." },
	})
	.input(
		z.compile(
			websiteLayoutGenerationInputSchema
				.omit({ schemaVersion: true })
				.extend({ updatedAt: z.string(), websiteId: z.uuid() })
				.meta({ id: "GenerateWebsiteLayoutInput" })
		)
	)
	.output(
		z.compile(
			z
				.strictObject({ websiteId: z.uuid(), workflowRunId: z.string().min(1) })
				.meta({ id: "GenerateWebsiteLayoutResponse" })
		)
	)
	.handler(({ context, errors, input }) =>
		startWebsiteModification({
			errors,
			input: { pattern: input.pattern, schemaVersion: 1, target: input.target },
			organizationId: context.organizationId,
			prepare: prepareWebsiteLayoutGenerationStart,
			start: startWebsiteLayoutGeneration,
			updatedAt: input.updatedAt,
			websiteId: input.websiteId,
		})
	);

const edit = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "PATCH",
			operationId: "editWebsite",
			path: "/websites/{websiteId}",
			summary: "Update website content, brand settings, or page sections",
			tags: ["websites"],
		})
	)
	.errors({
		CONFLICT: { message: "This website already has an active operation." },
		INVALID_EDIT: { message: "The requested website edit is unavailable." },
		NOT_FOUND: { message: "The website was not found." },
		SERVICE_UNAVAILABLE: { message: "Translation is unavailable right now. Please try again." },
	})
	.input(
		z
			.strictObject({ edit: websiteEditInputSchema, updatedAt: z.string(), websiteId: z.uuid() })
			.meta({ id: "EditWebsiteInput" })
	)
	.output(websiteStateSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			await requireWebsiteEditPermission({
				inputs: [input.edit],
				organizationId: context.organizationId,
				userId: context.session.user.id,
			});

			if (input.edit.operation === "add-language" && !input.edit.content) {
				return await translateWebsite({
					...input,
					locale: input.edit.locale,
					organizationId: context.organizationId,
					userId: context.session.user.id,
				});
			}

			return await editWebsite({
				inputs: [input.edit],
				organizationId: context.organizationId,
				updatedAt: input.updatedAt,
				websiteId: input.websiteId,
			});
		} catch (error) {
			if (error instanceof WebsiteDraftNotFoundError) {
				throw errors.NOT_FOUND();
			}

			if (error instanceof WebsiteMutationConflictError || error instanceof WebsiteGenerationConflictError) {
				throw errors.CONFLICT();
			}

			if (error instanceof WebsiteEditError) {
				throw errors.INVALID_EDIT();
			}

			if (error instanceof WebsiteTextTranslationError) {
				throw errors.SERVICE_UNAVAILABLE({ cause: error });
			}

			throw error;
		}
	});

const publish = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "publishWebsite",
			path: "/websites/{websiteId}/publish",
			summary: "Publish the current website draft",
			tags: ["websites"],
		})
	)
	.errors({
		CONFLICT: { message: "The website is busy or the draft changed before publication." },
		NOT_FOUND: { message: "The website draft was not found." },
	})
	.input(
		z.compile(z.strictObject({ updatedAt: z.string(), websiteId: z.uuid() }).meta({ id: "PublishWebsiteInput" }))
	)
	.output(websiteStateSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			return await publishWebsite({ organizationId: context.organizationId, ...input });
		} catch (error) {
			if (error instanceof WebsiteDraftNotFoundError) {
				throw errors.NOT_FOUND();
			}

			if (error instanceof WebsiteMutationConflictError) {
				throw errors.CONFLICT();
			}

			throw error;
		}
	});

const streamWorkflow = authedWithOrganization
	.meta(
		openapi({
			method: "GET",
			operationId: "streamWebsiteWorkflow",
			path: "/websites/{websiteId}/workflows/{workflowRunId}/events",
			summary: "Stream website workflow events",
			tags: ["websites"],
		})
	)
	.errors({
		NOT_FOUND: { message: "The website workflow was not found." },
	})
	.input(
		z.compile(
			z.strictObject({
				afterCursor: z.string().regex(/^\d+$/u).optional(),
				websiteId: z.uuid(),
				workflowRunId: z.string().min(1),
			})
		)
	)
	.output(eventIterator(websiteGenerationEnvelopeSchema))
	.handler(async ({ context, errors, input }) => {
		const record = await getWebsiteRecord({
			organizationId: context.organizationId,
			websiteId: input.websiteId,
		});

		if (!record || record.workflowRunId !== input.workflowRunId) {
			throw errors.NOT_FOUND();
		}

		return streamWebsiteWorkflow({ afterCursor: input.afterCursor, record, runId: input.workflowRunId });
	});

const sectionCatalog = authedWithOrganization
	.meta(
		openapi({
			method: "GET",
			operationId: "listWebsiteSectionCatalog",
			path: "/websites/{websiteId}/sections/catalog",
			summary: "List compatible generated section patterns",
			tags: ["websites"],
		})
	)
	.errors({
		INVALID_TARGET: { message: "The requested insertion target is unavailable." },
		NOT_FOUND: { message: "The website or page was not found." },
	})
	.input(
		z.compile(
			z.strictObject({
				category: z.enum(websiteGenerationSectionCategories).optional(),
				index: z.number().int().nonnegative(),
				pageId: z.uuid(),
				query: z.string().trim().min(1).max(100).optional(),
				recommend: z.string().trim().min(1).max(2000).optional(),
				websiteId: z.uuid(),
			})
		)
	)
	.output(
		z.compile(
			z.strictObject({
				patterns: z.array(
					z.strictObject({
						assetFields: z.number().int().nonnegative(),
						category: z.enum(websiteGenerationSectionCategories),
						linkFields: z.number().int().nonnegative(),
						pattern: z.string().min(1),
						previewAvailable: z.boolean(),
						roles: z.array(z.string().min(1)),
						score: z.number(),
						templateAffinity: z.boolean(),
						textFields: z.number().int().nonnegative(),
					})
				),
				recommendedPattern: z.string().min(1).nullable(),
			})
		)
	)
	.handler(async ({ context, errors, input, signal }) => {
		const snapshot = await getWebsiteSnapshot({
			notFound: errors.NOT_FOUND,
			organizationId: context.organizationId,
			websiteId: input.websiteId,
		});

		const { recommend, ...target } = input;

		const patterns = (() => {
			try {
				return listWebsiteSectionCatalog({ snapshot, ...target });
			} catch (error) {
				if (error instanceof WebsiteSectionAdditionInputError) {
					throw errors.INVALID_TARGET();
				}

				throw error;
			}
		})();

		return {
			patterns,
			recommendedPattern: recommend
				? await recommendWebsiteSectionPattern({ abortSignal: signal, patterns, request: recommend })
				: null,
		};
	});

const sectionPreviews = authedWithOrganization
	.meta(
		openapi({
			method: "GET",
			operationId: "previewWebsiteSections",
			path: "/websites/{websiteId}/sections/previews",
			summary: "Preview compatible generated section patterns",
			tags: ["websites"],
		})
	)
	.errors({
		INVALID_TARGET: { message: "The requested section pattern is unavailable." },
		NOT_FOUND: { message: "The website or page was not found." },
	})
	.input(
		z.compile(
			z.strictObject({
				pageId: z.uuid(),
				patterns: z.array(z.string().min(1)).min(1).max(8),
				websiteId: z.uuid(),
			})
		)
	)
	.output(z.array(z.strictObject({ assets: assetMapSchema, document: siteDocumentSchema, pattern: z.string() })))
	.handler(async ({ context, errors, input }) => {
		const website = await getWebsite({ organizationId: context.organizationId });

		if (!website?.snapshot || website.id !== input.websiteId) {
			throw errors.NOT_FOUND();
		}

		const snapshot = website.snapshot;

		try {
			return input.patterns.map((pattern) => {
				const preview = createWebsiteSectionCatalogPreview({
					brief: website.brief,
					pageId: input.pageId,
					pattern,
					snapshot,
					websiteId: website.id,
				});

				const page = preview.document.structure.pages.find(({ id }) => id === input.pageId);
				const section = page?.sections[0];

				if (!section) {
					throw new WebsiteSectionAdditionInputError("Website section preview is unavailable");
				}

				return {
					assets: preview.assets,
					document: createWebsiteSectionPreviewDocument({
						document: preview.document,
						section,
						target: { area: "page", index: 0, pageId: input.pageId, sectionId: section.id },
					}),
					pattern,
				};
			});
		} catch (error) {
			if (error instanceof WebsiteSectionAdditionInputError) {
				throw errors.INVALID_TARGET();
			}

			throw error;
		}
	});

const cancelWorkflow = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "cancelWebsiteWorkflow",
			path: "/websites/{websiteId}/workflows/{workflowRunId}/cancel",
			summary: "Cancel the active website workflow",
			tags: ["websites"],
		})
	)
	.errors({
		NOT_FOUND: { message: "The website workflow was not found." },
	})
	.input(
		z.compile(
			z.strictObject({
				websiteId: z.uuid(),
				workflowRunId: z.string().min(1),
			})
		)
	)
	.output(z.compile(z.strictObject({ cancelled: z.boolean() })))
	.handler(async ({ context, errors, input }) => {
		const cancelled = await cancelWebsiteWorkflow({ organizationId: context.organizationId, ...input });

		if (!cancelled) {
			throw errors.NOT_FOUND();
		}

		return { cancelled };
	});

const unpublish = authedWithOrganization
	.use(organizationPermission("write"))
	.meta(
		openapi({
			method: "POST",
			operationId: "unpublishWebsite",
			path: "/websites/{websiteId}/unpublish",
			summary: "Take the published website offline",
			tags: ["websites"],
		})
	)
	.errors({
		CONFLICT: { message: "The website is busy or the draft changed before it was unpublished." },
		NOT_FOUND: { message: "The website draft was not found." },
	})
	.input(
		z.compile(z.strictObject({ updatedAt: z.string(), websiteId: z.uuid() }).meta({ id: "UnpublishWebsiteInput" }))
	)
	.output(websiteStateSchema)
	.handler(async ({ context, errors, input }) => {
		try {
			return await unpublishWebsite({ organizationId: context.organizationId, ...input });
		} catch (error) {
			if (error instanceof WebsiteDraftNotFoundError) {
				throw errors.NOT_FOUND();
			}

			throw error instanceof WebsiteMutationConflictError ? errors.CONFLICT() : error;
		}
	});

export const websites = {
	...websitePreviews,
	...websiteTemplates,
	addSection,
	agentChat,
	cancelWorkflow,
	edit,
	generate,
	generateLayout,
	get,
	publish,
	sectionCatalog,
	sectionPreviews,
	streamWorkflow,
	unpublish,
};
