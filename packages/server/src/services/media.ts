import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { db, files } from "@starter/db";
import {
	detectKind,
	getExtensionFromFilename,
	mediaContentTypes,
	normalizeContentType,
	uploadPolicies,
	uploadPurposes,
} from "@starter/documents";
import { log, serializeLogError } from "@starter/observability";

import { decisionClassifiers } from "../ai/decisions";
import { rankRelevantCandidates } from "../ai/relevance";
import { deleteBlob, getPublicBlobUrl, getStorageKeyPrefix, headBlob } from "../lib/blob-storage";
import { startFileIngestion } from "./documents";
import { createFile, deleteFile, getFileUrl } from "./storage";

export const mediaListInputSchema = z.compile(
	z.object({
		kind: z.enum(["image", "video"]).optional(),
		offset: z.number().int().nonnegative().default(0),
		purpose: z.enum(["logo"]).optional(),
		query: z.string().trim().max(100).default(""),
		semantic: z
			.boolean()
			.optional()
			.describe("Rerank recent uploads by meaning when the filename query finds nothing."),
	})
);

export const uploadedMediaSchema = z.compile(
	z.object({
		contentType: z.string(),
		id: z.uuid(),
		kind: z.enum(["image", "video"]),
		name: z.string(),
		sizeBytes: z.number().nullable(),
		url: z.url(),
	})
);

const semanticCandidateLimit = 20;

const queryUploadedMedia = ({
	kind,
	limit,
	offset,
	organizationId,
	purpose,
	query,
}: {
	kind?: "image" | "video";
	limit: number;
	offset: number;
	organizationId: string;
	purpose?: "logo";
	query: string;
}) =>
	db
		.select({
			contentType: files.contentType,
			id: files.id,
			kind: files.kind,
			metadata: files.metadata,
			name: files.name,
			sizeBytes: files.sizeBytes,
			storageKey: files.storageKey,
			summary: files.summary,
			title: files.title,
		})
		.from(files)
		.where(
			and(
				eq(files.organizationId, organizationId),
				eq(files.access, "public"),
				eq(files.sourceType, "upload"),
				inArray(files.contentType, [...(purpose ? uploadPolicies[purpose].contentTypes : mediaContentTypes)]),
				inArray(files.kind, ["image", "video"]),
				isNull(files.deletedAt),
				kind ? eq(files.kind, kind) : undefined,
				query ? ilike(files.name, `%${query.replaceAll(/[%_\\]/g, String.raw`\$&`)}%`) : undefined
			)
		)
		.orderBy(desc(files.createdAt), desc(files.id))
		.limit(limit)
		.offset(offset);

const projectUploadedMedia = (rows: Awaited<ReturnType<typeof queryUploadedMedia>>) =>
	Promise.all(
		rows.flatMap(({ kind, metadata: _metadata, storageKey, summary: _summary, title: _title, ...row }) =>
			(kind === "image" || kind === "video") && storageKey
				? [(async () => ({ ...row, kind, url: await getPublicBlobUrl(storageKey) }))()]
				: []
		)
	);

export const listUploadedMedia = async ({
	abortSignal,
	kind,
	offset,
	organizationId,
	purpose,
	query,
	semantic = false,
}: z.infer<typeof mediaListInputSchema> & { abortSignal?: AbortSignal; organizationId: string }) => {
	const rows = await queryUploadedMedia({ kind, limit: 31, offset, organizationId, purpose, query });

	if (rows.length === 0 && semantic && query && offset === 0) {
		const candidates = await queryUploadedMedia({
			kind,
			limit: semanticCandidateLimit,
			offset: 0,
			organizationId,
			purpose,
			query: "",
		});

		const ranked = await rankRelevantCandidates({
			abortSignal,
			candidates,
			classifier: decisionClassifiers.mediaRelevance,
			query,
			text: ({ metadata, name, summary, title }) =>
				[title, name, summary, metadata.altText, metadata.ocrText].filter(Boolean).join("\n"),
		});

		return { items: await projectUploadedMedia(ranked), nextOffset: null };
	}

	return {
		items: await projectUploadedMedia(rows.slice(0, 30)),
		nextOffset: rows.length > 30 ? offset + 30 : null,
	};
};

export const getUploadedMedia = async ({ fileId, organizationId }: { fileId: string; organizationId: string }) => {
	const row = await db.query.files.findFirst({
		where: { access: "public", deletedAt: { isNull: true }, id: fileId, organizationId },
	});

	const parsed = uploadedMediaSchema.safeParse(row && { ...row, url: await getFileUrl(row) });

	if (!parsed.success || !row || !mediaContentTypes.includes(row.contentType) || row.sourceType !== "upload") {
		throw new Error("Uploaded media not found");
	}

	return parsed.data;
};

export const deleteUploadedMedia = async ({
	fileId,
	organizationId,
	userId,
}: {
	fileId: string;
	organizationId: string;
	userId: string;
}) => {
	try {
		await getUploadedMedia({ fileId, organizationId });
	} catch {
		return false;
	}

	return deleteFile({ deletedBy: userId, fileId, organizationId });
};

export const registerUploadInputSchema = z.compile(
	z.strictObject({
		key: z
			.string()
			.max(255)
			.regex(/^[\w-]+(?:\.[\w-]+)*$/),
		name: z.string().trim().min(1).max(255),
		purpose: z.enum(uploadPurposes),
	})
);

export const registeredUploadSchema = z.compile(z.strictObject({ id: z.uuid(), url: z.string().nullable() }));

export class UploadRejectedError extends Error {}

const rejectUpload = async ({
	access,
	key,
	message,
}: {
	access: "private" | "public";
	key: string;
	message: string;
}) => {
	try {
		await deleteBlob({ access, key });
	} catch (error) {
		await log.warn({ error: serializeLogError(error), message: "Rejected upload Blob cleanup failed" });
	}

	return new UploadRejectedError(message);
};

export const registerUpload = async ({
	input: { name, purpose, ...input },
	organizationId,
	userId,
}: {
	input: z.infer<typeof registerUploadInputSchema>;
	organizationId: string;
	userId: string;
}) => {
	const policy = uploadPolicies[purpose];
	const key = `${getStorageKeyPrefix({ organizationId, purpose })}${input.key}`;
	const stored = await headBlob({ access: policy.access, key });

	if (!stored) {
		throw new UploadRejectedError("The upload was not found.");
	}

	const contentType = normalizeContentType(stored.contentType);

	const kind = detectKind({
		extension: getExtensionFromFilename({ filename: name }) ?? undefined,
		mediaType: contentType,
	});

	const indexable = purpose === "knowledge";

	if (
		!policy.contentTypes.includes(contentType) ||
		(indexable && kind !== "image" && kind !== "document" && kind !== "text")
	) {
		throw await rejectUpload({ access: policy.access, key, message: "Unsupported upload type." });
	}

	if (stored.size > policy.maxFileSizeMb * 1024 * 1024) {
		throw await rejectUpload({ access: policy.access, key, message: "Uploaded file exceeds its size limit." });
	}

	const { created, file } = await createFile({
		access: policy.access,
		contentType,
		kind,
		name,
		organizationId,
		ragStatus: indexable ? "pending" : "none",
		sizeBytes: stored.size,
		sourceType: "upload",
		storageKey: key,
		uploadedBy: userId,
	});

	if (indexable && created) {
		await startFileIngestion({ fileId: file.id, organizationId });
	}

	return { id: file.id, url: await getFileUrl(file) };
};
