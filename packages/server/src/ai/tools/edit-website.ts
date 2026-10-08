import { createTool } from "@mastra/core/tools";
import type { Schema } from "ai";
import { randomUUID } from "node:crypto";

import type { WebsiteAssetBindings, WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";
import {
	listSectionContentReferences,
	inspectSectionContent,
	inspectSectionStructure,
	mergeSectionContentPatch,
	stringValueSchema,
	websiteEditInputSchema,
	type WebsiteEditInput,
} from "@starter/infinite-website/editing";

import { requireOrganizationPermission } from "../../services/permissions";
import { requireWebsiteEditPermission } from "../../services/websites/permissions";
import { editWebsite } from "../../services/websites/service";
import { appContextSchema } from "../types";
import {
	buildWebsiteToolContract,
	buildWebsiteProviderInputSchema,
	composeWebsiteSectionToolContract,
	composeWebsiteSectionProviderInputSchema,
	editWebsiteToolContract,
	websiteSectionEditSchema,
	materializeWebsiteCopy,
	type BuildWebsiteToolInput,
	type EditWebsiteToolInput,
} from "../website-contracts";
import {
	getCurrentWebsite,
	parseContractInput,
	prepareBuildDraft,
	prepareComposeDraft,
	resolveLink,
} from "../website-drafts";
import {
	listSectionCollections,
	listSectionTexts,
	listWebsiteSectionHandles,
	resolveWebsiteLinkHandle,
	resolveWebsiteSectionHandle,
	resolveWebsiteTextHandle,
} from "../website-texts";

const expandedEditsLimit = 200;

const requireContractApproval = async <Input>(schema: Schema, input: Input) =>
	(await schema.validate?.(input))?.success === true;

const saveWebsiteEdits = async ({
	assetBindings,
	inputs,
	organizationId,
	revision,
	userId,
	websiteId,
}: {
	assetBindings?: WebsiteAssetBindings;
	inputs: Array<WebsiteEditInput>;
	organizationId: string;
	revision: string;
	userId: string;
	websiteId: string;
}) => {
	await requireWebsiteEditPermission({ inputs, organizationId, userId });

	const website = await editWebsite({
		assetBindings,
		inputs,
		organizationId,
		updatedAt: revision,
		websiteId,
	});

	return { revision: website.updatedAt };
};

const expandMenuEdit = ({
	document,
	edit,
	section,
}: {
	document: WebsiteSnapshotV1["document"];
	edit: Extract<EditWebsiteToolInput["edits"][number], { operation: "update-menu-item" | "delete-menu-item" }>;
	section: WebsiteSnapshotV1["document"]["structure"]["layout"]["header"][number];
}) => {
	const target = resolveWebsiteLinkHandle({ handle: edit.target, section });

	if (!target || target.menuItemId !== target.elementId) {
		throw new Error("Inspected menu item not found");
	}

	if (edit.operation === "delete-menu-item") {
		return websiteEditInputSchema.parse({
			elementId: target.elementId,
			operation: edit.operation,
			sectionId: section.id,
		});
	}

	const items = edit.items.map((item) => {
		const existing = item.target ? resolveWebsiteLinkHandle({ handle: item.target, section }) : undefined;

		if (
			item.target &&
			(!existing || existing.menuItemId !== target.elementId || existing.menuRole !== "dropdown-item")
		) {
			throw new Error("Inspected dropdown item not found");
		}

		return {
			id: existing?.elementId ?? randomUUID(),
			label: item.label,
			value: resolveLink({ document, value: item.value }),
		};
	});

	return websiteEditInputSchema.parse({
		elementId: target.elementId,
		items,
		kind: edit.kind,
		label: edit.label,
		locale: edit.locale,
		operation: edit.operation,
		sectionId: section.id,
		value: resolveLink({ document, value: edit.value }),
	});
};

const expandMediaEdit = ({
	edit,
	section,
}: {
	edit: Extract<EditWebsiteToolInput["edits"][number], { operation: "update-media" }>;
	section: WebsiteSnapshotV1["document"]["structure"]["layout"]["header"][number];
}) => {
	const reference = listSectionContentReferences({ kind: "asset", node: section.root })[Number(edit.target.slice(1))];

	if (!reference || !("$asset" in reference)) {
		throw new Error("Inspected media slot not found");
	}

	return websiteEditInputSchema.parse({
		alt: edit.alt,
		fileId: edit.fileId,
		operation: "update-media",
		pointer: reference.$asset,
		sectionId: section.id,
	});
};

const expandCopyEdit = ({
	document,
	edit,
	pageId,
	section,
}: {
	document: WebsiteSnapshotV1["document"];
	edit: Extract<EditWebsiteToolInput["edits"][number], { operation: "update-copy" }>;
	pageId: string | null;
	section: WebsiteSnapshotV1["document"]["structure"]["layout"]["header"][number];
}) => {
	const structure = inspectSectionStructure({ section });
	const content = inspectSectionContent({ document, section });

	if (!structure || !content || !pageId) {
		throw new Error("Composed section not found");
	}

	return [
		websiteEditInputSchema.parse({
			content: mergeSectionContentPatch({
				content,
				patch: materializeWebsiteCopy({ copy: edit.copy, images: undefined, structure }),
				structure,
			}),
			operation: "update-section",
			pageId,
			sectionId: section.id,
		}),
	];
};

const expandContentEdits = ({
	document,
	edits,
}: {
	document: WebsiteSnapshotV1["document"];
	edits: EditWebsiteToolInput["edits"];
}) => {
	const candidates = listWebsiteSectionHandles({ document });

	const inputs = edits.flatMap<WebsiteEditInput>((edit) => {
		if (edit.operation === "find-replace-text") {
			const locale = edit.locale ?? document.defaultLocale;

			const replacements = candidates.flatMap(({ section }) =>
				listSectionTexts({ document, locale, section }).flatMap(({ pointer, value }) =>
					value.includes(edit.find)
						? [
								{
									locale,
									operation: "update-text" as const,
									pointer,
									sectionId: section.id,
									value: value.replaceAll(edit.find, edit.replace),
								},
							]
						: []
				)
			);

			if (replacements.length === 0) {
				throw new Error(`No website text contains "${edit.find}"`);
			}

			return replacements;
		}

		const target = resolveWebsiteSectionHandle({ document, handle: edit.section });

		if (!target) {
			throw new Error("Website section not found");
		}

		if (edit.operation === "update-media") {
			return [expandMediaEdit({ edit, section: target.section })];
		}

		if (edit.operation === "update-copy") {
			return expandCopyEdit({ document, edit, pageId: target.pageId, section: target.section });
		}

		if (edit.operation === "update-menu-item" || edit.operation === "delete-menu-item") {
			return [expandMenuEdit({ document, edit, section: target.section })];
		}

		const sectionId = target.section.id;
		const sectionEdit = websiteSectionEditSchema.safeParse(edit);

		if (sectionEdit.success) {
			if (!target.pageId) {
				throw new Error("This operation requires a page section");
			}

			const input = { operation: sectionEdit.data.operation, pageId: target.pageId, sectionId };

			return [
				websiteEditInputSchema.parse(
					sectionEdit.data.operation === "swap-layout"
						? { ...input, pattern: sectionEdit.data.pattern }
						: input
				),
			];
		}

		if (edit.operation === "add-collection-item" || edit.operation === "delete-collection-item") {
			const collection = listSectionCollections({ document, section: target.section }).find(
				({ handle }) => handle === edit.collection
			);

			if (!collection) {
				throw new Error("Inspected collection not found");
			}

			const itemId =
				edit.operation === "add-collection-item"
					? randomUUID()
					: collection.items.find(({ handle }) => handle === edit.item)?.id;

			if (!itemId) {
				throw new Error("Inspected collection item not found");
			}

			return [
				websiteEditInputSchema.parse({
					collection: collection.pointer,
					itemId,
					operation: edit.operation,
					sectionId,
				}),
			];
		}

		if (edit.operation === "update-link") {
			const link = resolveWebsiteLinkHandle({ handle: edit.target, section: target.section });

			if (!link) {
				throw new Error("Website link not found");
			}

			return [
				websiteEditInputSchema.parse({
					label: edit.label
						? { pointers: link.labels.map(({ pointer }) => pointer), value: edit.label }
						: undefined,
					locale: edit.locale,
					operation: edit.operation,
					pointer: link.pointer,
					sectionId,
					value: resolveLink({ document, value: edit.value }),
				}),
			];
		}

		if (edit.operation !== "update-text") {
			throw new Error("Unsupported website edit");
		}

		const text = resolveWebsiteTextHandle({ handle: edit.target, section: target.section });
		const pointer = stringValueSchema.safeParse(text ? Object.values(text).at(0) : undefined);

		if (!pointer.success) {
			throw new Error("Website text not found");
		}

		return [
			websiteEditInputSchema.parse({
				locale: edit.locale,
				operation: edit.operation,
				pointer: pointer.data,
				sectionId,
				value: edit.value,
			}),
		];
	});

	if (inputs.length > expandedEditsLimit) {
		throw new Error("The edit expands beyond the safe limit");
	}

	return inputs;
};

const executeBuildWebsite = async ({
	input,
	organizationId,
	userId,
}: {
	input: BuildWebsiteToolInput;
	organizationId: string;
	userId: string;
}) => {
	const draft = await prepareBuildDraft({ input, organizationId });

	return saveWebsiteEdits({
		assetBindings: draft.assetBindings,
		inputs: draft.inputs,
		organizationId: draft.organizationId,
		revision: input.revision,
		userId,
		websiteId: draft.websiteId,
	});
};

export const editWebsiteTools = {
	buildWebsite: createTool({
		...buildWebsiteToolContract,
		execute: async (input, { requestContext }) => {
			const parsed = await parseContractInput(buildWebsiteToolContract.inputSchema, input);
			await requireOrganizationPermission({
				...requestContext.all,
				permission: parsed.remove?.length || parsed.logic === null ? "delete" : "write",
			});

			return executeBuildWebsite({
				input: parsed,
				organizationId: requestContext.get("organizationId"),
				userId: requestContext.get("userId"),
			});
		},
		id: "build-website",
		inputSchema: buildWebsiteProviderInputSchema,
		requestContextSchema: appContextSchema,
		requireApproval: (input) => requireContractApproval(buildWebsiteToolContract.inputSchema, input),
	}),
	composeWebsiteSection: createTool({
		...composeWebsiteSectionToolContract,
		execute: async (rawInput, { requestContext }) => {
			await requireOrganizationPermission({ ...requestContext.all, permission: "write" });
			const input = await parseContractInput(composeWebsiteSectionToolContract.inputSchema, rawInput);

			const draft = await prepareComposeDraft({
				input,
				organizationId: requestContext.get("organizationId"),
			});

			return saveWebsiteEdits({
				assetBindings: draft.assetBindings,
				inputs: draft.inputs,
				organizationId: draft.organizationId,
				revision: input.revision,
				userId: requestContext.get("userId"),
				websiteId: draft.websiteId,
			});
		},
		id: "compose-website-section",
		inputSchema: composeWebsiteSectionProviderInputSchema,
		requestContextSchema: appContextSchema,
		requireApproval: (input) => requireContractApproval(composeWebsiteSectionToolContract.inputSchema, input),
	}),
	editWebsite: createTool({
		...editWebsiteToolContract,
		execute: async ({ edits, revision }, { requestContext }) => {
			await requireOrganizationPermission({
				...requestContext.all,
				permission: edits.some(({ operation }) => operation === "delete" || operation.startsWith("delete-"))
					? "delete"
					: "write",
			});
			const website = await getCurrentWebsite({ organizationId: requestContext.get("organizationId"), revision });

			return saveWebsiteEdits({
				inputs: expandContentEdits({ document: website.snapshot.document, edits }),
				organizationId: website.organizationId,
				revision,
				userId: requestContext.get("userId"),
				websiteId: website.id,
			});
		},
		id: "edit-website",
		requestContextSchema: appContextSchema,
		requireApproval: true,
	}),
};
