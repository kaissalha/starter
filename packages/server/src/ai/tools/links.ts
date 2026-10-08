import { createTool } from "@mastra/core/tools";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
	defaultLinkPageSectionAppearance,
	linkPageAlignments,
	linkPageBlockSchema,
	linkPageCollectionDisplays,
	linkPageDocumentSchema,
	linkPageLinkLayouts,
	linkPageLimits,
	linkPageProfileLayouts,
	linkPageSocialPlatforms,
	linkPageTitleSizes,
	type LinkPageBlock,
	type LinkPageDocument,
} from "@starter/infinite-links/contracts";
import { appearanceOperations, blockOperations, socialOperations } from "@starter/infinite-links/editing";
import { applyLinkPageTheme, linkPageThemes } from "@starter/infinite-links/themes";

import { getLinkPage, publishLinkPage, recommendLinkPageTheme, saveLinkPage } from "../../services/link-pages";
import { findUnownedMediaUrls } from "../../services/media";
import { requireOrganizationPermission } from "../../services/permissions";
import { linkPageCopyInstructions, linkPageGenerationLimits } from "../prompts";
import { appContextSchema } from "../types";

const localizedText = (max: number) =>
	z
		.record(z.string().min(2).max(10), z.string().trim().max(max))
		.describe('Text keyed by locale code, for example { "en": "Contact us", "ar": "تواصل معنا" }.');

const label = localizedText(linkPageGenerationLimits.label).describe(
	"A concise destination/action label, ideally 1–4 words. Do not repeat the business name or location, or use an SEO title."
);

const title = localizedText(linkPageGenerationLimits.title);

const text = localizedText(linkPageGenerationLimits.text);

const url = z
	.string()
	.min(1)
	.max(2000)
	.describe("An absolute http(s) URL or a same-domain website path such as /about.");

const blockId = z.uuid().describe("An existing block id from getLinkPage.");

const index = z.number().int().nonnegative().optional().describe("Position among blocks; appends when omitted.");

const linkFields = {
	imageUrl: url.nullable().optional(),
	label,
	url,
};

const linkPageEditSchema = z.discriminatedUnion("operation", [
	z.strictObject({
		...linkFields,
		index,
		layout: z.enum(linkPageLinkLayouts).optional(),
		operation: z.literal("add-link"),
	}),
	z.strictObject({ index, operation: z.literal("add-header"), text: title }),
	z.strictObject({
		button: z.strictObject(linkFields).nullable().optional(),
		index,
		operation: z.literal("add-text"),
		text,
	}),
	z.strictObject({ index, operation: z.literal("add-video"), title: title.optional(), url }),
	z.strictObject({
		display: z.enum(linkPageCollectionDisplays).optional(),
		index,
		links: z.array(z.strictObject(linkFields)).min(1).max(100),
		operation: z.literal("add-collection"),
		title: title.optional(),
	}),
	z
		.strictObject({
			button: z.strictObject(linkFields).nullable().optional(),
			display: z.enum(linkPageCollectionDisplays).optional(),
			enabled: z.boolean().optional(),
			id: blockId,
			imageUrl: url.nullable().optional(),
			label: label.optional(),
			layout: z.enum(linkPageLinkLayouts).optional(),
			operation: z.literal("update-block"),
			text: text.optional(),
			title: title.optional(),
			url: url.optional(),
		})
		.describe("Send only the fields that exist on the block's kind."),
	z.strictObject({ id: blockId, operation: z.literal("remove-block") }),
	z.strictObject({ id: blockId, index: z.number().int().nonnegative(), operation: z.literal("move-block") }),
	z.strictObject({
		alignment: z.enum(linkPageAlignments).optional(),
		bio: localizedText(linkPageGenerationLimits.bio)
			.describe("One short factual sentence, ideally 6–12 words. Do not repeat the profile title.")
			.optional(),
		imageUrl: url.nullable().optional(),
		layout: z.enum(linkPageProfileLayouts).optional(),
		operation: z.literal("update-profile"),
		title: localizedText(linkPageLimits.title).optional(),
		titleSize: z.enum(linkPageTitleSizes).optional(),
	}),
	z.strictObject({ operation: z.literal("add-social"), platform: z.enum(linkPageSocialPlatforms), url }),
	z.strictObject({
		id: z.uuid(),
		operation: z.literal("update-social"),
		platform: z.enum(linkPageSocialPlatforms).optional(),
		url: url.optional(),
	}),
	z.strictObject({ id: z.uuid(), operation: z.literal("remove-social") }),
	z.strictObject({ id: blockId.nullable(), operation: z.literal("set-redirect") }),
	z.strictObject({ id: blockId, linked: z.boolean(), operation: z.literal("set-header-link") }),
]);

type LinkPageEdit = z.infer<typeof linkPageEditSchema>;

type AddBlockEdit = Extract<
	LinkPageEdit,
	{ operation: "add-collection" | "add-header" | "add-link" | "add-text" | "add-video" }
>;

const editLinkPageInputSchema = z.compile(
	z.strictObject({ edits: z.array(linkPageEditSchema).min(1).max(30), updatedAt: z.string().nullable() })
);

const defined = <Value extends object>(value: Value) =>
	Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined));

const newBlock = <Fields extends object>(fields: Fields) =>
	linkPageBlockSchema.parse({
		appearance: defaultLinkPageSectionAppearance,
		enabled: true,
		id: randomUUID(),
		...fields,
	});

const createBlock = (edit: AddBlockEdit) => {
	switch (edit.operation) {
		case "add-collection":
			return newBlock({
				display: edit.display ?? "stack",
				kind: "collection",
				links: edit.links.map((link) => newBlock({ kind: "link", layout: "classic", ...link })),
				title: edit.title ?? {},
			});
		case "add-header":
			return newBlock({ kind: "header", text: edit.text });
		case "add-link":
			return newBlock({
				imageUrl: edit.imageUrl,
				kind: "link",
				label: edit.label,
				layout: edit.layout ?? "classic",
				url: edit.url,
			});
		case "add-text":
			return newBlock({ button: edit.button ?? null, kind: "text", text: edit.text });
		case "add-video":
			return newBlock({ kind: "video", title: edit.title ?? {}, url: edit.url });
	}
};

const requireBlock = (document: LinkPageDocument, id: string) => {
	if (!document.blocks.some((block) => block.id === id)) {
		throw new Error("Block not found");
	}
};

const requireChange = (document: LinkPageDocument, next: LinkPageDocument) => {
	if (next === document) {
		throw new Error("The Links page limit for this item is reached");
	}

	return next;
};

const addBlock = (document: LinkPageDocument, block: LinkPageBlock, index?: number) =>
	requireChange(document, blockOperations.add(document, block, index));

const socialsBlockId = (document: LinkPageDocument) => document.blocks.find(({ kind }) => kind === "socials")?.id;

const edited = (document: LinkPageDocument, edit: LinkPageEdit): LinkPageDocument => {
	switch (edit.operation) {
		case "add-social": {
			const item = { id: randomUUID(), platform: edit.platform, url: edit.url };
			const blockId = socialsBlockId(document);

			return blockId
				? requireChange(document, socialOperations.add(document, blockId, item))
				: addBlock(document, newBlock({ items: [item], kind: "socials" }));
		}

		case "move-block": {
			requireBlock(document, edit.id);

			return blockOperations.moveTo(document, edit.id, edit.index);
		}

		case "remove-block":
			return blockOperations.remove(document, edit.id);
		case "remove-social": {
			const blockId = socialsBlockId(document);

			return blockId ? socialOperations.remove(document, blockId, edit.id) : document;
		}

		case "set-header-link":
			requireBlock(document, edit.id);

			return blockOperations.setHeaderLinked(document, edit.id, edit.linked);
		case "set-redirect":
			return appearanceOperations.redirect(document, edit.id);
		case "update-block": {
			const { id, operation: _operation, ...patch } = edit;

			return blockOperations.patch(document, id, (block) => ({ ...block, ...defined(patch) }));
		}

		case "update-profile": {
			const { operation: _operation, ...patch } = edit;

			return appearanceOperations.profile(document, defined(patch));
		}

		case "update-social": {
			const { id, operation: _operation, ...patch } = edit;
			const blockId = socialsBlockId(document);

			return blockId
				? socialOperations.update(document, blockId, id, (item) => ({ ...item, ...defined(patch) }))
				: document;
		}

		default:
			return addBlock(document, createBlock(edit), edit.index);
	}
};

const applyLinkPageEdits = (document: LinkPageDocument, edits: Array<LinkPageEdit>) =>
	edits.reduce((draft, edit, position) => {
		const result = linkPageDocumentSchema.safeParse(edited(draft, edit));

		if (!result.success) {
			throw new Error(`Edit ${position + 1} (${edit.operation}) is invalid: ${z.prettifyError(result.error)}`);
		}

		return result.data;
	}, document);

export const linksTools = {
	changeLinkPageTheme: createTool({
		description:
			"Apply an approved catalog theme to Links only, preserving the shared website Brand and all Links content. Requires getLinkPage in this turn and its exact updatedAt. Explicit choices skip recommendation.",
		execute: async ({ themeId, updatedAt }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });
			const theme = linkPageThemes.find(({ id }) => id === themeId);

			if (!theme) {
				throw new Error("Unknown Links theme");
			}

			const organizationId = requestContext.get("organizationId");
			const current = await getLinkPage({ organizationId });

			const state = await saveLinkPage({
				document: applyLinkPageTheme({ document: current.document, theme }),
				organizationId,
				updatedAt,
				userId: requestContext.get("userId"),
			});

			return { hasUnpublishedChanges: state.publication.hasUnpublishedChanges, updatedAt: state.updatedAt };
		},
		id: "change-link-page-theme",
		inputSchema: z.compile(
			z.strictObject({ themeId: z.enum(linkPageThemes.map(({ id }) => id)), updatedAt: z.string().min(1) })
		),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	editLinkPage: createTool({
		description: `Apply a batch of narrow edits to the Links page draft and save it. Reference existing blocks by the ids returned by getLinkPage in this turn; new blocks need only their content, the server assigns ids and appearance. Use the exact updatedAt revision from that getLinkPage result. ${linkPageCopyInstructions}`,
		execute: async ({ edits, updatedAt }, { requestContext }) => {
			await requireOrganizationPermission({
				...requestContext.all,
				permission: edits.some(({ operation }) => operation === "remove-block" || operation === "remove-social")
					? "delete"
					: "write",
			});
			const organizationId = requestContext.get("organizationId");

			const foreign = await findUnownedMediaUrls({
				organizationId,
				urls: [
					...new Set(
						edits
							.flatMap((edit) => {
								switch (edit.operation) {
									case "add-collection": {
										return edit.links.map(({ imageUrl }) => imageUrl);
									}

									case "add-link":
									case "update-profile": {
										return [edit.imageUrl];
									}

									case "add-text": {
										return [edit.button?.imageUrl];
									}

									case "update-block": {
										return [edit.imageUrl, edit.button?.imageUrl];
									}

									default: {
										return [];
									}
								}
							})
							.filter((value) => value !== null && value !== undefined)
					),
				],
			});

			if (foreign.length > 0) {
				throw new Error(
					"Image URLs must come from the organization's media library. Use URLs returned by listUploadedMedia, findStockImage or selectStockImage."
				);
			}

			const current = await getLinkPage({ organizationId });

			const state = await saveLinkPage({
				document: applyLinkPageEdits(current.document, edits),
				organizationId,
				updatedAt,
				userId: requestContext.get("userId"),
			});

			return { hasUnpublishedChanges: state.publication.hasUnpublishedChanges, updatedAt: state.updatedAt };
		},
		id: "edit-link-page",
		inputSchema: editLinkPageInputSchema,
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	getLinkPage: createTool({
		description:
			"Get the active organization's complete Links page draft, inherited Brand, publication state, and current revision. Call on every user request, including follow-ups: a successful read unlocks editLinkPage and publishLinkPage on the next step. Earlier reads do not unlock them.",
		execute: async (_input, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "read" });

			return getLinkPage({ organizationId: requestContext.get("organizationId") });
		},
		id: "get-link-page",
		inputSchema: z.compile(z.object({})),
		requestContextSchema: appContextSchema,
	}),
	publishLinkPage: createTool({
		description:
			"Publish one approved Links page draft. Use the exact updatedAt revision from a getLinkPage result returned in the same turn.",
		execute: async ({ updatedAt }, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });
			const state = await publishLinkPage({ organizationId: requestContext.get("organizationId"), updatedAt });

			return { publishedAt: state.publication.publishedAt, updatedAt: state.updatedAt };
		},
		id: "publish-link-page",
		inputSchema: z.compile(z.strictObject({ updatedAt: z.string() })),
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
	recommendLinkPageTheme: createTool({
		description:
			"Recommend an existing Links-only theme from a natural-language style request after getLinkPage. Makes no changes. Review then use approval-gated changeLinkPageTheme; for precise custom colors or unclear requests ask for clarification.",
		execute: async ({ request }, { abortSignal, observe, requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "read" });
			const { theme } = await recommendLinkPageTheme({ abortSignal, observe, request });

			return { theme };
		},
		id: "recommend-link-page-theme",
		inputSchema: z.compile(z.strictObject({ request: z.string().trim().min(1).max(2000) })),
		requestContextSchema: appContextSchema,
	}),
};
