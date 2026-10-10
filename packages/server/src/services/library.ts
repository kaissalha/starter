import { generateImage } from "ai";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, notInArray, or, sql, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import sharp from "sharp";
import { z } from "zod";

import { db, fileTagAssignments, fileTags, files, organizations, type FileRecord } from "@starter/db";

import { models } from "../ai/models";
import { createLogoGenerationPrompt } from "../ai/prompts";
import { getPublicBlobUrl, getStorageKeyPrefix, uploadBufferToBlob } from "../lib/blob-storage";
import { checkRateLimit } from "../lib/redis";
import { startFileIngestion } from "./documents";
import { createFile, deleteFile, getFile, getFileUrl } from "./storage";

export class LibraryError extends Error {
	code: "CONFLICT" | "NOT_EDITABLE" | "NOT_FOUND" | "RATE_LIMITED";
	constructor(code: LibraryError["code"], message: string) {
		super(message);
		this.code = code;
	}
}

export type LibraryActor = { organizationId: string; userId: string };

export const libraryChatScope = ({ groupId, userId }: { groupId?: string; userId: string }) => ({
	libraryChat: `${userId}:${groupId ?? "library"}`,
});

const libraryKinds = ["image", "video", "document"] as const;

const imageSizes = { landscape: "1536x1024", portrait: "1024x1536", square: "1024x1024" } as const;

const maxDocumentLength = 200_000;

const maxSourceImageBytes = 10 * 1024 * 1024;

const pageSize = 36;

const fileStatusSchema = z.enum(["none", "pending", "ready", "failed"]);

export const libraryAssetSchema = z
	.strictObject({
		access: z.enum(["public", "private"]),
		contentType: z.string(),
		createdAt: z.string(),
		editable: z.boolean(),
		generated: z.boolean(),
		generating: z.boolean(),
		height: z.number().nullable(),
		id: z.uuid(),
		kind: z.enum(libraryKinds),
		name: z.string(),
		sizeBytes: z.number().nullable(),
		status: fileStatusSchema,
		summary: z.string().nullable(),
		updatedAt: z.string(),
		url: z.string().nullable(),
		versionCount: z.int(),
		width: z.number().nullable(),
	})
	.meta({ id: "LibraryAsset" });

export const libraryAssetDetailSchema = libraryAssetSchema
	.extend({
		category: z.string().nullable(),
		content: z.string().nullable(),
		docDate: z.string().nullable(),
		generation: z.strictObject({ model: z.string(), prompt: z.string() }).nullable(),
		groupId: z.uuid(),
		language: z.string().nullable(),
		tags: z.array(z.string()),
		versions: z.array(
			z.strictObject({
				createdAt: z.string(),
				generating: z.boolean(),
				id: z.uuid(),
				status: fileStatusSchema,
				url: z.string().nullable(),
			})
		),
	})
	.meta({ id: "LibraryAssetDetail" });

export const libraryListInputSchema = z
	.strictObject({
		kind: z.enum(["all", ...libraryKinds]).default("all"),
		offset: z.int().min(0).max(10_000).default(0),
		query: z.string().trim().max(100).default(""),
		sort: z.enum(["newest", "oldest", "name", "largest"]).default("newest"),
		source: z.enum(["all", "uploaded", "generated"]).default("all"),
		versions: z.enum(["latest", "all"]).default("latest"),
	})
	.meta({ id: "ListLibraryAssetsInput" });

export const libraryListResultSchema = z.strictObject({
	counts: z.strictObject({ all: z.int(), document: z.int(), image: z.int(), video: z.int() }),
	items: z.array(libraryAssetSchema),
	nextOffset: z.int().nullable(),
});

export const libraryAssetIdSchema = z.strictObject({ assetId: z.uuid() });

const documentNameSchema = z.string().trim().min(1).max(200);

const documentContentSchema = z.string().max(maxDocumentLength);

export const libraryDocumentCreateSchema = z
	.strictObject({ content: documentContentSchema.default(""), name: documentNameSchema })
	.meta({ id: "CreateLibraryDocument" });

export const libraryAssetUpdateSchema = z
	.strictObject({
		assetId: z.uuid(),
		content: documentContentSchema.optional(),
		name: documentNameSchema.optional(),
		updatedAt: z.string().min(1).max(64).describe("Exact updatedAt of the asset this change is based on."),
	})
	.meta({ id: "UpdateLibraryAsset" });

export const libraryDocumentEditSchema = z
	.strictObject({
		assetId: z.uuid(),
		edits: z
			.array(
				z.strictObject({
					find: z.string().min(1).max(20_000).describe("Exact existing text. Must occur exactly once."),
					replace: z
						.string()
						.max(maxDocumentLength)
						.describe("Replacement Markdown. Empty removes the text."),
				})
			)
			.min(1)
			.max(40),
		updatedAt: z.string().min(1).max(64).describe("Exact updatedAt returned by getLibraryAsset in this turn."),
	})
	.meta({ id: "EditLibraryDocument" });

export const libraryImageGenerateSchema = z
	.strictObject({
		aspect: z.enum(["square", "landscape", "portrait"]).default("square"),
		prompt: z.string().trim().min(1).max(4000),
		sourceAssetId: z.uuid().optional().describe("Existing library image to edit. The result is a new asset."),
	})
	.meta({ id: "GenerateLibraryImage" });

export const libraryLogoGenerateSchema = z
	.strictObject({
		prompt: z.string().trim().max(1000).default("").describe("Optional style direction for the logo."),
	})
	.meta({ id: "GenerateLibraryLogo" });

const kindFilter = (kind: (typeof libraryKinds)[number]) =>
	kind === "document" ? notInArray(files.kind, ["image", "video"]) : eq(files.kind, kind);

const generatedFilter = sql`${files.metadata} ? 'generation'`;

const groupKey = ({ id, versionGroupId }: { id: SQLWrapper; versionGroupId: SQLWrapper }) =>
	sql`coalesce(${versionGroupId}, ${id})`;

const newerVersions = alias(files, "newer_versions");

const latestVersionFilter = sql`not exists (select 1 from ${files} as "newer_versions" where ${newerVersions.organizationId} = ${files.organizationId} and ${groupKey(newerVersions)} = ${groupKey(files)} and ${newerVersions.deletedAt} is null and (${newerVersions.createdAt}, ${newerVersions.id}) > (${files.createdAt}, ${files.id}))`;

const versionCountColumn = sql<number>`(select count(*)::int from ${files} as "newer_versions" where ${newerVersions.organizationId} = ${files.organizationId} and ${groupKey(newerVersions)} = ${groupKey(files)} and ${newerVersions.deletedAt} is null)`;

const isGenerating = (file: FileRecord) =>
	Boolean(file.metadata.generation) && file.storageKey === null && file.ragStatus !== "failed";

const toLibraryAsset = async (file: FileRecord, versionCount = 1) => ({
	access: file.access,
	contentType: file.contentType,
	createdAt: file.createdAt,
	editable: file.content !== null,
	generated: Boolean(file.metadata.generation),
	generating: isGenerating(file),
	height: file.metadata.height ?? null,
	id: file.id,
	kind: file.kind === "image" || file.kind === "video" ? file.kind : ("document" as const),
	name: file.title?.trim() || file.name,
	sizeBytes: file.sizeBytes,
	status: file.ragStatus,
	summary: file.summary,
	updatedAt: file.updatedAt,
	url: await getFileUrl(file),
	versionCount,
	width: file.metadata.width ?? null,
});

const requireLibraryFile = async ({ assetId, organizationId }: { assetId: string; organizationId: string }) => {
	const file = await getFile({ fileId: assetId, organizationId });

	if (!file || file.deletedAt) {
		throw new LibraryError("NOT_FOUND", "Library asset not found.");
	}

	return file;
};

export const listLibraryAssets = async ({
	input,
	organizationId,
}: {
	input: z.infer<typeof libraryListInputSchema>;
	organizationId: string;
}) => {
	const pattern = `%${input.query.replaceAll(/[%_\\]/g, String.raw`\$&`)}%`;

	const scope = and(
		eq(files.organizationId, organizationId),
		isNull(files.deletedAt),
		or(isNotNull(files.storageKey), isNotNull(files.content), generatedFilter),
		input.versions === "latest" ? latestVersionFilter : undefined,
		input.query
			? or(
					sql`${files.fts} @@ websearch_to_tsquery('english', ${input.query})`,
					ilike(files.name, pattern),
					ilike(files.title, pattern),
					sql`exists (select 1 from ${fileTagAssignments} inner join ${fileTags} on ${fileTags.id} = ${fileTagAssignments.tagId} where ${fileTagAssignments.fileId} = ${files.id} and ${fileTags.name} ilike ${pattern})`
				)
			: undefined,
		input.source === "generated" ? generatedFilter : undefined,
		input.source === "uploaded" ? sql`not (${generatedFilter})` : undefined
	);

	const order = {
		largest: [sql`${files.sizeBytes} desc nulls last`, desc(files.id)],
		name: [asc(sql`lower(coalesce(${files.title}, ${files.name}))`), desc(files.id)],
		newest: [desc(files.createdAt), desc(files.id)],
		oldest: [asc(files.createdAt), asc(files.id)],
	}[input.sort];

	const [rows, [totals]] = await Promise.all([
		db
			.select({ file: files, versionCount: versionCountColumn })
			.from(files)
			.where(and(scope, input.kind === "all" ? undefined : kindFilter(input.kind)))
			.orderBy(...order)
			.limit(pageSize + 1)
			.offset(input.offset),
		db
			.select({
				all: count(),
				document: count(sql`case when ${kindFilter("document")} then 1 end`),
				image: count(sql`case when ${kindFilter("image")} then 1 end`),
				video: count(sql`case when ${kindFilter("video")} then 1 end`),
			})
			.from(files)
			.where(scope),
	]);

	return {
		counts: totals ?? { all: 0, document: 0, image: 0, video: 0 },
		items: await Promise.all(
			rows.slice(0, pageSize).map(({ file, versionCount }) => toLibraryAsset(file, versionCount))
		),
		nextOffset: rows.length > pageSize ? input.offset + pageSize : null,
	};
};

const toLibraryAssetDetail = async (
	file: FileRecord,
	{ tags = [], versions = [] }: { tags?: Array<string>; versions?: Array<FileRecord> } = {}
) => ({
	...(await toLibraryAsset(file, Math.max(versions.length, 1))),
	category: file.metadata.documentCategory ?? null,
	content: file.content,
	docDate: file.docDate,
	generation: file.metadata.generation
		? { model: file.metadata.generation.model, prompt: file.metadata.generation.prompt }
		: null,
	groupId: file.versionGroupId ?? file.id,
	language: file.language,
	tags,
	versions: await Promise.all(
		versions.map(async (version) => ({
			createdAt: version.createdAt,
			generating: isGenerating(version),
			id: version.id,
			status: version.ragStatus,
			url: await getFileUrl(version),
		}))
	),
});

export const getLibraryAsset = async ({ assetId, organizationId }: { assetId: string; organizationId: string }) => {
	const file = await requireLibraryFile({ assetId, organizationId });

	const [tags, versions] = await Promise.all([
		db
			.select({ name: fileTags.name })
			.from(fileTagAssignments)
			.innerJoin(fileTags, eq(fileTags.id, fileTagAssignments.tagId))
			.where(and(eq(fileTagAssignments.fileId, file.id), eq(fileTagAssignments.organizationId, organizationId)))
			.orderBy(asc(fileTags.name)),
		db
			.select()
			.from(files)
			.where(
				and(
					eq(files.organizationId, organizationId),
					isNull(files.deletedAt),
					sql`${groupKey(files)} = ${file.versionGroupId ?? file.id}`
				)
			)
			.orderBy(asc(files.createdAt), asc(files.id))
			.limit(50),
	]);

	return toLibraryAssetDetail(file, { tags: tags.map(({ name }) => name), versions });
};

export const createLibraryDocument = async ({
	actor,
	input,
}: {
	actor: LibraryActor;
	input: z.infer<typeof libraryDocumentCreateSchema>;
}) => {
	const { file } = await createFile({
		access: "private",
		content: input.content,
		contentType: "text/markdown",
		kind: "text",
		name: input.name,
		organizationId: actor.organizationId,
		sizeBytes: Buffer.byteLength(input.content),
		sourceType: "text",
		uploadedBy: actor.userId,
	});

	return toLibraryAssetDetail(file);
};

export const updateLibraryAsset = async ({
	actor,
	input,
}: {
	actor: LibraryActor;
	input: z.infer<typeof libraryAssetUpdateSchema>;
}) => {
	const file = await requireLibraryFile({ assetId: input.assetId, organizationId: actor.organizationId });

	if (input.content !== undefined && file.content === null) {
		throw new LibraryError("NOT_EDITABLE", "This asset's content cannot be edited as text.");
	}

	const [updated] = await db
		.update(files)
		.set({
			content: input.content,
			name: input.name,
			sizeBytes: input.content === undefined ? undefined : Buffer.byteLength(input.content),
			title: input.name === undefined ? undefined : null,
			updatedAt: new Date().toISOString(),
		})
		.where(
			and(
				eq(files.id, file.id),
				eq(files.organizationId, actor.organizationId),
				eq(files.updatedAt, input.updatedAt),
				isNull(files.deletedAt)
			)
		)
		.returning();

	if (!updated) {
		throw new LibraryError("CONFLICT", "The asset changed elsewhere. Read it again before saving.");
	}

	return getLibraryAsset({ assetId: updated.id, organizationId: actor.organizationId });
};

export const applyLibraryDocumentEdits = ({
	content,
	edits,
}: {
	content: string;
	edits: z.infer<typeof libraryDocumentEditSchema>["edits"];
}) =>
	edits.reduce((current, { find, replace }) => {
		if (current.split(find).length !== 2) {
			throw new LibraryError(
				"CONFLICT",
				`Edit text must match exactly once: ${JSON.stringify(find.slice(0, 80))}`
			);
		}

		return current.replace(find, () => replace);
	}, content);

export const editLibraryDocument = async ({
	actor,
	input,
}: {
	actor: LibraryActor;
	input: z.infer<typeof libraryDocumentEditSchema>;
}) => {
	const file = await requireLibraryFile({ assetId: input.assetId, organizationId: actor.organizationId });

	if (file.content === null) {
		throw new LibraryError("NOT_EDITABLE", "This asset's content cannot be edited as text.");
	}

	const content = applyLibraryDocumentEdits({ content: file.content, edits: input.edits });

	if (content.length > maxDocumentLength) {
		throw new LibraryError("CONFLICT", "The edited document exceeds the length limit.");
	}

	return updateLibraryAsset({ actor, input: { assetId: file.id, content, updatedAt: input.updatedAt } });
};

export const deleteLibraryAsset = ({ actor, assetId }: { actor: LibraryActor; assetId: string }) =>
	deleteFile({ deletedBy: actor.userId, fileId: assetId, organizationId: actor.organizationId });

const loadSourceImage = async (file: FileRecord) => {
	if (file.kind !== "image" || file.access !== "public" || !file.storageKey) {
		throw new LibraryError("NOT_EDITABLE", "Only library images can be edited.");
	}

	const response = await fetch(await getPublicBlobUrl(file.storageKey), { signal: AbortSignal.timeout(30_000) });
	const body = response.ok ? new Uint8Array(await response.arrayBuffer()) : null;

	if (!body || body.byteLength > maxSourceImageBytes) {
		throw new LibraryError("NOT_EDITABLE", "The source image could not be loaded.");
	}

	return body;
};

const finishLibraryImage = async ({
	abortSignal,
	actor,
	fileId,
	request,
	transform,
}: {
	abortSignal?: AbortSignal;
	actor: LibraryActor;
	fileId: string;
	request: Pick<Parameters<typeof generateImage>[0], "model" | "prompt" | "providerOptions" | "size">;
	transform?: (image: Uint8Array) => Promise<Buffer>;
}) => {
	const { image } = await generateImage({
		...request,
		abortSignal: AbortSignal.any([AbortSignal.timeout(180_000), ...(abortSignal ? [abortSignal] : [])]),
		maxRetries: 1,
	});

	const body = transform ? await transform(image.uint8Array) : Buffer.from(image.uint8Array);

	const blob = await uploadBufferToBlob({
		access: "public",
		buffer: body,
		mediaType: image.mediaType,
		prefix: getStorageKeyPrefix({ organizationId: actor.organizationId, purpose: "image" }),
	});

	const [file] = await db
		.update(files)
		.set({
			contentType: image.mediaType,
			sizeBytes: blob.size,
			storageKey: blob.key,
			updatedAt: new Date().toISOString(),
		})
		.where(and(eq(files.id, fileId), eq(files.organizationId, actor.organizationId)))
		.returning();

	if (!file) {
		throw new LibraryError("NOT_FOUND", "Library asset not found.");
	}

	await startFileIngestion({ fileId, organizationId: actor.organizationId });

	return file;
};

export const generateLibraryImage = async ({
	abortSignal,
	actor,
	input,
}: {
	abortSignal?: AbortSignal;
	actor: LibraryActor;
	input: z.infer<typeof libraryImageGenerateSchema>;
}) => {
	const sourceFile = input.sourceAssetId
		? await requireLibraryFile({ assetId: input.sourceAssetId, organizationId: actor.organizationId })
		: null;

	const source = sourceFile ? await loadSourceImage(sourceFile) : null;
	const [width, height] = imageSizes[input.aspect].split("x").map(Number);
	const generation = { model: models.image.model.modelId, prompt: input.prompt, sourceFileId: sourceFile?.id };

	const { file } = await createFile({
		access: "public",
		contentType: "image/png",
		kind: "image",
		metadata: source ? { generation } : { generation, height, width },
		name: sourceFile ? (sourceFile.title ?? sourceFile.name) : input.prompt.slice(0, 80),
		organizationId: actor.organizationId,
		ragStatus: "pending",
		uploadedBy: actor.userId,
		versionGroupId: sourceFile ? (sourceFile.versionGroupId ?? sourceFile.id) : null,
	});

	try {
		const generated = await finishLibraryImage({
			abortSignal,
			actor,
			fileId: file.id,
			request: {
				model: models.image.model,
				prompt: source ? { images: [source], text: input.prompt } : input.prompt,
				size: source ? undefined : imageSizes[input.aspect],
			},
		});

		return await toLibraryAsset(generated);
	} catch (error) {
		await deleteFile({ deletedBy: actor.userId, fileId: file.id, organizationId: actor.organizationId });
		throw error;
	}
};

const logoPadding = 16;

const trimLogo = (image: Uint8Array) =>
	sharp(image)
		.trim()
		.extend({
			background: { alpha: 0, b: 0, g: 0, r: 0 },
			bottom: logoPadding,
			left: logoPadding,
			right: logoPadding,
			top: logoPadding,
		})
		.png()
		.toBuffer();

const readLogoBusinessContext = async ({ organizationId }: { organizationId: string }) => {
	const [organization] = await db
		.select({ name: organizations.name })
		.from(organizations)
		.where(eq(organizations.id, organizationId))
		.limit(1);

	return { businessName: organization?.name ?? "" };
};

export const generateLibraryLogo = async ({
	abortSignal,
	actor,
	input,
}: {
	abortSignal?: AbortSignal;
	actor: LibraryActor;
	input: z.infer<typeof libraryLogoGenerateSchema>;
}) => {
	const { allowed } = await checkRateLimit({
		key: `library-logo:${actor.organizationId}`,
		max: 20,
		windowSeconds: 60 * 60,
	});

	if (!allowed) {
		throw new LibraryError("RATE_LIMITED", "Too many logos generated. Try again later.");
	}

	const context = await readLogoBusinessContext({ organizationId: actor.organizationId });
	const prompt = createLogoGenerationPrompt({ ...context, request: input.prompt });

	const { file } = await createFile({
		access: "public",
		contentType: "image/png",
		kind: "image",
		metadata: { generation: { model: models.logo.model.modelId, prompt } },
		name: `${context.businessName || "Business"} logo`,
		organizationId: actor.organizationId,
		ragStatus: "pending",
		uploadedBy: actor.userId,
	});

	try {
		const generated = await finishLibraryImage({
			abortSignal,
			actor,
			fileId: file.id,
			request: { ...models.logo, prompt, size: imageSizes.square },
			transform: trimLogo,
		});

		return await toLibraryAsset(generated);
	} catch (error) {
		await deleteFile({ deletedBy: actor.userId, fileId: file.id, organizationId: actor.organizationId });
		throw error;
	}
};
