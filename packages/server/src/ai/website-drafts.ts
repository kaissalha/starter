import type { Schema } from "ai";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import { getFailFastRedis } from "@starter/cache";
import {
	websiteAssetBindingsSchema,
	type WebsiteAssetBindings,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/contracts";
import {
	createWebsiteSectionNeighborhoodDocument,
	editWebsiteSnapshots,
	inspectSectionContent,
	inspectSectionStructure,
	mergeSectionContentPatch,
	patchSectionStructure,
	prepareWebsiteEditInputs,
	websiteEditInputSchema,
	type WebsiteEditInput,
} from "@starter/infinite-website/editing";
import { entityIdFromSeed, listSiteDocumentAssetIds } from "@starter/infinite-website/generation";

import { getUploadedMedia } from "../services/media";
import { resolveWebsiteAuthoringMedia } from "../services/websites/assets";
import { getWebsite, WebsiteMutationConflictError } from "../services/websites/service";
import {
	materializeWebsiteCopy,
	type BuildWebsiteToolInput,
	type ComposeWebsiteSectionToolInput,
	type WebsiteImages,
	type WebsiteLinks,
	type WebsiteLinkValue,
} from "./website-contracts";
import { resolveWebsitePageHandle, resolveWebsiteSectionHandle } from "./website-texts";

const draftMediaTtlSeconds = 30 * 60;

const draftMediaSchema = z.compile(
	z.strictObject({ assets: z.record(z.string(), z.string()), bindings: websiteAssetBindingsSchema })
);

export const getCurrentWebsite = async ({ organizationId, revision }: { organizationId: string; revision: string }) => {
	const website = await getWebsite({ organizationId });
	const snapshot = website?.snapshot;

	if (!website || !snapshot) {
		throw new Error("Website draft not found");
	}

	if (website.updatedAt !== revision) {
		throw new WebsiteMutationConflictError();
	}

	return { id: website.id, organizationId, snapshot };
};

export const parseContractInput = async <Value, Input>(schema: Schema<Value>, input: Input) => {
	const validated = await schema.validate?.(input);

	if (!validated?.success) {
		throw validated?.error ?? new Error("Invalid website mutation");
	}

	return validated.value;
};

const draftMediaKey = ({
	organizationId,
	queries,
}: {
	organizationId: string;
	queries: Record<string, { alt: unknown; query: string }>;
}) =>
	`website-draft-media:v1:${organizationId}:${createHash("sha256")
		.update(JSON.stringify(Object.entries(queries).map(([key, { query }]) => [key, query])))
		.digest("hex")}`;

const readDraftMedia = async (key: string) => {
	try {
		const cached = await getFailFastRedis()?.get(key);

		return cached ? (draftMediaSchema.safeParse(JSON.parse(cached)).data ?? null) : null;
	} catch {
		return null;
	}
};

const writeDraftMedia = async ({ key, value }: { key: string; value: z.infer<typeof draftMediaSchema> }) => {
	try {
		await getFailFastRedis()?.set(key, JSON.stringify(value), "EX", draftMediaTtlSeconds);
	} catch {
		return;
	}
};

const resolveStockMedia = async ({
	organizationId,
	queries,
}: {
	organizationId: string;
	queries: Record<string, { alt: unknown; query: string }>;
}) => {
	if (Object.keys(queries).length === 0) {
		return { assets: {}, bindings: {} };
	}

	const key = draftMediaKey({ organizationId, queries });
	const cached = await readDraftMedia(key);

	if (cached) {
		return { assets: { ...cached.assets }, bindings: { ...cached.bindings } };
	}

	const resolved = await resolveWebsiteAuthoringMedia(queries);
	await writeDraftMedia({ key, value: { assets: resolved.assets, bindings: resolved.bindings } });

	return resolved;
};

export const resolveImages = async ({
	images,
	organizationId,
}: {
	images: WebsiteImages | undefined;
	organizationId: string;
}) => {
	if (!images) {
		return { assetBindings: undefined, assets: undefined };
	}

	const entries = Object.entries(images);

	const queries = Object.fromEntries(
		entries.flatMap(([key, image]) => (image.query ? [[key, { alt: image.alt, query: image.query }]] : []))
	);

	const { assets, bindings } = await resolveStockMedia({ organizationId, queries });

	const uploads = await Promise.all(
		entries
			.flatMap(([key, image]) => (image.fileId ? [{ fileId: image.fileId, key }] : []))
			.map(async ({ fileId, key }) => ({ key, media: await getUploadedMedia({ fileId, organizationId }) }))
	);

	for (const { key, media } of uploads) {
		assets[key] = media.id;
		bindings[media.id] = { src: media.url, type: media.kind };
	}

	return { assetBindings: bindings, assets };
};

export const resolveLink = ({
	document,
	value,
}: {
	document: WebsiteSnapshotV1["document"];
	value: WebsiteLinkValue;
}) => {
	if (value.kind === "page") {
		const page = resolveWebsitePageHandle({ document, handle: value.page });
		const section = value.section ? resolveWebsiteSectionHandle({ document, handle: value.section }) : undefined;

		if (!page || (value.section !== undefined && !section) || (section && section.pageId !== page.id)) {
			throw new Error("Website link target not found");
		}

		return section
			? { kind: "page" as const, pageId: page.id, sectionId: section.section.id }
			: { kind: "page" as const, pageId: page.id };
	}

	if (value.kind === "section") {
		const section = resolveWebsiteSectionHandle({ document, handle: value.section });

		if (!section) {
			throw new Error("Website link target not found");
		}

		return { kind: "section" as const, sectionId: section.section.id };
	}

	return value;
};

export const resolveLinks = ({
	document,
	links,
}: {
	document: WebsiteSnapshotV1["document"];
	links: WebsiteLinks | undefined;
}) =>
	links
		? Object.fromEntries(Object.entries(links).map(([key, value]) => [key, resolveLink({ document, value })]))
		: undefined;

export type WebsiteDraft = {
	assetBindings?: WebsiteAssetBindings;
	inputs: Array<WebsiteEditInput>;
	organizationId: string;
	pageId: string;
	sectionId: string;
	snapshot: WebsiteSnapshotV1;
	visual: boolean;
	websiteId: string;
};

export const prepareComposeDraft = async ({
	input: { anchor, category, copy, images, index, links, logic, page, revision, structure },
	organizationId,
}: {
	input: ComposeWebsiteSectionToolInput;
	organizationId: string;
}): Promise<WebsiteDraft> => {
	const website = await getCurrentWebsite({ organizationId, revision });
	const target = resolveWebsitePageHandle({ document: website.snapshot.document, handle: page });

	if (!target) {
		throw new Error("Website page not found");
	}

	const resolved = await resolveImages({ images, organizationId: website.organizationId });

	const content = materializeWebsiteCopy({
		assets: resolved.assets,
		copy,
		images,
		links: resolveLinks({ document: website.snapshot.document, links }),
		structure,
	});

	const seed = randomUUID();

	return {
		assetBindings: resolved.assetBindings,
		inputs: [
			{
				anchor,
				category,
				index,
				operation: "add-composed-section",
				pageId: target.id,
				seed,
				specification: { content, logic, structure },
			},
		],
		organizationId: website.organizationId,
		pageId: target.id,
		sectionId: entityIdFromSeed({ seed: `${seed}:section` }),
		snapshot: website.snapshot,
		visual: true,
		websiteId: website.id,
	};
};

export const prepareBuildDraft = async ({
	input: { copy, images, links, logic, nodes, remove, revision, section },
	organizationId,
}: {
	input: BuildWebsiteToolInput;
	organizationId: string;
}): Promise<WebsiteDraft> => {
	const website = await getCurrentWebsite({ organizationId, revision });
	const document = website.snapshot.document;
	const target = resolveWebsiteSectionHandle({ document, handle: section });

	if (!target || !target.pageId) {
		throw new Error("Website section not found");
	}

	const base = {
		organizationId: website.organizationId,
		pageId: target.pageId,
		sectionId: target.section.id,
		snapshot: website.snapshot,
		websiteId: website.id,
	};

	const structure = inspectSectionStructure({ section: target.section });
	const content = inspectSectionContent({ document, section: target.section });

	if (!structure || !content) {
		if (nodes || remove || copy || images || links || logic === undefined) {
			throw new Error("Composed section not found");
		}

		return {
			...base,
			assetBindings: undefined,
			inputs: [
				websiteEditInputSchema.parse({
					logic,
					operation: "update-section",
					pageId: target.pageId,
					sectionId: target.section.id,
				}),
			],
			visual: false,
		};
	}

	const nextStructure = patchSectionStructure({ patches: nodes, remove, structure });
	const resolved = await resolveImages({ images, organizationId: website.organizationId });
	const changesStructure = Boolean(nodes || remove || copy || images || links);

	const patch = materializeWebsiteCopy({
		assets: resolved.assets,
		copy,
		images,
		links: resolveLinks({ document, links }),
		structure: nextStructure,
	});

	return {
		...base,
		assetBindings: resolved.assetBindings,
		inputs: [
			websiteEditInputSchema.parse({
				content: changesStructure
					? mergeSectionContentPatch({ content, patch, structure: nextStructure })
					: undefined,
				logic,
				operation: "update-section",
				pageId: target.pageId,
				sectionId: target.section.id,
				structure: changesStructure ? nextStructure : undefined,
			}),
		],
		visual: changesStructure,
	};
};

export const previewWebsiteDraft = async ({ assetBindings, inputs, pageId, sectionId, snapshot }: WebsiteDraft) => {
	const edited = editWebsiteSnapshots({ inputs: await prepareWebsiteEditInputs(inputs), snapshot });
	const document = createWebsiteSectionNeighborhoodDocument({ document: edited.document, pageId, sectionId });
	const referenced = new Set(listSiteDocumentAssetIds({ document }));
	const assets = Object.entries({ ...snapshot.assets, ...assetBindings }).filter(([id]) => referenced.has(id));

	return { ...edited, assets: Object.fromEntries(assets), document };
};
