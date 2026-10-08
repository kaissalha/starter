import { createTool } from "@mastra/core/tools";
import type { ToolResultPart } from "ai";
import { z } from "zod";

import {
	websiteBriefSchema,
	websiteGenerationProfiles,
	websiteSnapshotSchema,
} from "@starter/infinite-website/generation";

import { requireOrganizationPermission } from "../../services/permissions";
import {
	createWebsiteHomepagePreviewSkeleton,
	generateWebsiteHomepagePreview,
} from "../../services/websites/homepage-preview";
import {
	cancelWebsiteWorkflow,
	getWebsite,
	prepareWebsiteGenerationStart,
	prepareWebsiteLayoutGenerationStart,
	prepareWebsiteSectionAdditionStart,
	prepareWebsiteTemplateChangeStart,
	publishWebsite,
	WebsiteMutationConflictError,
} from "../../services/websites/service";
import {
	startWebsiteGeneration,
	startWebsiteLayoutGeneration,
	startWebsiteSectionAddition,
} from "../../workflows/start";
import { appContextSchema } from "../types";
import { websitePageHandleSchema, websiteSectionHandleSchema } from "../website-contracts";
import { listSectionTexts, resolveWebsitePageHandle, resolveWebsiteSectionHandle } from "../website-texts";

const requireWebsite = async (organizationId: string) => {
	const website = await getWebsite({ organizationId });

	if (!website) {
		throw new Error("Website not found");
	}

	return website;
};

const revisionSchema = z.string().min(1);

export const websiteTools = {
	addWebsiteSection: createTool({
		description:
			"Start one approved section-addition workflow. Use the page handle, insertion index, allowed pattern, and revision from an inspectWebsite result returned in the same turn.",
		execute: async ({ index, page, pattern, revision }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });
			const organizationId = requestContext.get("organizationId");
			const website = await requireWebsite(organizationId);

			const target = website.snapshot
				? resolveWebsitePageHandle({ document: website.snapshot.document, handle: page })
				: undefined;

			if (!target) {
				throw new Error("Website page not found");
			}

			const prepared = await prepareWebsiteSectionAdditionStart({
				input: { index, pageId: target.id, pattern, schemaVersion: 1 },
				organizationId,
				websiteId: website.id,
			});

			if (prepared.record.updatedAt !== revision) {
				throw new WebsiteMutationConflictError();
			}

			await startWebsiteSectionAddition({
				expectedRunId: prepared.expectedRunId,
				expectedUpdatedAt: revision,
				input: prepared.input,
				organizationId,
				websiteId: website.id,
			});

			return { started: true };
		},
		id: "add-website-section",
		inputSchema: z.compile(
			z.strictObject({
				index: z.number().int().nonnegative(),
				page: websitePageHandleSchema,
				pattern: z.string().min(1),
				revision: revisionSchema,
			})
		),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	cancelWebsiteWorkflow: createTool({
		description: "Cancel the exact workflow run returned by getWebsiteStatus. Requires approval.",
		execute: async ({ workflowRunId }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });
			const organizationId = requestContext.get("organizationId");
			const website = await requireWebsite(organizationId);

			return { cancelled: await cancelWebsiteWorkflow({ organizationId, websiteId: website.id, workflowRunId }) };
		},
		id: "cancel-website-workflow",
		inputSchema: z.compile(z.strictObject({ workflowRunId: z.string().min(1) })),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	changeWebsiteTemplate: createTool({
		description:
			"Regenerate the website using a listed template after inspection and approval. Explain that this replaces the draft's design and content.",
		execute: async ({ revision, templateId }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "delete" });
			const organizationId = requestContext.get("organizationId");
			const website = await requireWebsite(organizationId);

			const prepared = await prepareWebsiteTemplateChangeStart({
				input: { schemaVersion: 1, templateId },
				organizationId,
				websiteId: website.id,
			});

			if (prepared.record.updatedAt !== revision) {
				throw new WebsiteMutationConflictError();
			}

			return startWebsiteGeneration({
				brief: prepared.brief,
				expectedRunId: prepared.expectedRunId,
				expectedUpdatedAt: revision,
				organizationId,
				templateId,
				websiteId: website.id,
			});
		},
		id: "change-website-template",
		inputSchema: z.compile(z.strictObject({ revision: revisionSchema, templateId: z.string().min(1).max(100) })),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	generateWebsite: createTool({
		description:
			"Start initial website generation from an approved business brief when getWebsiteStatus shows no draft. Does not replace an existing draft.",
		execute: async (brief, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });
			const organizationId = requestContext.get("organizationId");

			const prepared = await prepareWebsiteGenerationStart({
				brief: websiteBriefSchema.parse({ ...brief, schemaVersion: 1 }),
				organizationId,
			});

			return startWebsiteGeneration({
				brief: prepared.brief,
				expectedRunId: prepared.expectedRunId,
				organizationId,
				websiteId: prepared.record.id,
			});
		},
		id: "generate-website",
		inputSchema: z.compile(
			z.strictObject({
				location: z.string().trim().min(1).max(200).describe("City or region the business serves."),
				name: z.string().trim().min(1).max(120),
				type: z
					.string()
					.trim()
					.min(1)
					.max(120)
					.describe("What the business is, for example specialty coffee shop."),
			})
		),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	generateWebsiteLayout: createTool({
		description:
			"Generate content for an inspected section's new catalog layout. Use editWebsite swap-layout when inspection marks a layout as not requiring generation.",
		execute: async ({ pattern, revision, section }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "delete" });
			const organizationId = requestContext.get("organizationId");
			const website = await requireWebsite(organizationId);

			const target = website.snapshot
				? resolveWebsiteSectionHandle({ document: website.snapshot.document, handle: section })
				: undefined;

			if (!target) {
				throw new Error("Website section not found");
			}

			const prepared = await prepareWebsiteLayoutGenerationStart({
				input: {
					pattern,
					schemaVersion: 1,
					target:
						target.area === "page" && target.pageId
							? { area: "page", index: target.index, pageId: target.pageId, sectionId: target.section.id }
							: {
									area: target.area === "header" ? "header" : "footer",
									index: target.index,
									sectionId: target.section.id,
								},
				},
				organizationId,
				websiteId: website.id,
			});

			if (prepared.record.updatedAt !== revision) {
				throw new WebsiteMutationConflictError();
			}

			return startWebsiteLayoutGeneration({
				expectedRunId: prepared.expectedRunId,
				expectedUpdatedAt: revision,
				input: prepared.input,
				organizationId,
				websiteId: website.id,
			});
		},
		id: "generate-website-layout",
		inputSchema: z.compile(
			z.strictObject({
				pattern: z.string().min(1).max(100),
				revision: revisionSchema,
				section: websiteSectionHandleSchema,
			})
		),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	getWebsiteStatus: createTool({
		description:
			"Read whether a website exists, its revision, and generation workflow status without loading its document into context.",
		execute: async (_input, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "read" });
			const website = await getWebsite({ organizationId: requestContext.get("organizationId") });

			return website
				? {
						exists: true,
						hasDraft: Boolean(website.snapshot),
						revision: website.updatedAt,
						workflow: website.workflow,
					}
				: { exists: false };
		},
		id: "get-website-status",
		inputSchema: z.compile(z.strictObject({})),
		requestContextSchema: appContextSchema,
	}),
	listWebsiteTemplates: createTool({
		description: "List supported website templates and business keywords before selecting a replacement template.",
		execute: async (_input, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "read" });

			return websiteGenerationProfiles.map(({ keywords, name, templateId }) => ({ keywords, name, templateId }));
		},
		id: "list-website-templates",
		inputSchema: z.compile(z.strictObject({})),
		requestContextSchema: appContextSchema,
	}),
	previewWebsiteTemplate: createTool({
		description:
			"Preview a listed template against the current website brief without replacing the draft. Skeleton is deterministic; generated preview calls models and media providers. Approval is required.",
		execute: async ({ mode, templateId }, { abortSignal, requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });
			const organizationId = requestContext.get("organizationId");
			const website = await requireWebsite(organizationId);

			if (!websiteGenerationProfiles.some((profile) => profile.templateId === templateId)) {
				throw new Error("Template not found");
			}

			const input = {
				abortSignal,
				brief: website.brief,
				existingAssets: Object.values(website.snapshot?.assets ?? {}),
				locale: website.snapshot?.document.defaultLocale ?? "en",
				previewScope: website.snapshot
					? { organizationId, revision: website.updatedAt, websiteId: website.id }
					: undefined,
				snapshot: website.snapshot ?? undefined,
				templateId,
				websiteId: website.id,
			};

			return mode === "skeleton"
				? createWebsiteHomepagePreviewSkeleton(input)
				: generateWebsiteHomepagePreview(input);
		},
		id: "preview-website-template",
		inputSchema: z.compile(
			z.strictObject({ mode: z.enum(["skeleton", "generated"]), templateId: z.string().min(1).max(100) })
		),
		outputSchema: websiteSnapshotSchema,
		requestContextSchema: appContextSchema,
		requireApproval: true,
		toModelOutput: ({ document, templateId }) =>
			({
				type: "json",
				value: {
					pages: document.structure.pages.map((page) => ({
						sections: page.sections.map((section) => ({
							category: section.category,
							text: listSectionTexts({ document, locale: document.defaultLocale, section })
								.slice(0, 6)
								.map(({ value }) => value.slice(0, 300)),
						})),
					})),
					templateId,
				},
			}) satisfies ToolResultPart["output"],
	}),
	publishWebsite: createTool({
		description: "Publish every change in the exact inspected website draft, including Brand. Requires approval.",
		execute: async ({ revision }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });
			const organizationId = requestContext.get("organizationId");
			const website = await requireWebsite(organizationId);
			const result = await publishWebsite({ organizationId, updatedAt: revision, websiteId: website.id });

			return { revision: result.updatedAt };
		},
		id: "publish-website",
		inputSchema: z.compile(z.strictObject({ revision: revisionSchema })),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
};
