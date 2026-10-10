import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { db, files } from "@starter/db";
import {
	detectKind,
	getExtensionFromFilename,
	mediaContentTypes,
	normalizeContentType,
	uploadPolicies,
	type UploadPurpose,
} from "@starter/documents";

import { decisionClassifiers } from "../ai/decisions";
import { rankRelevantCandidates } from "../ai/relevance";
import { getPublicBlobUrl } from "../lib/blob-storage";
import { startIngestFile } from "../workflows/ingest-file";
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

export const deleteUploadedMedia = async ({
	fileId,
	organizationId,
	userId,
}: {
	fileId: string;
	organizationId: string;
	userId: string;
}) => {
	const row = await db.query.files.findFirst({
		where: { access: "public", deletedAt: { isNull: true }, id: fileId, organizationId, sourceType: "upload" },
	});

	if (
		!row?.storageKey ||
		!mediaContentTypes.includes(row.contentType) ||
		(row.kind !== "image" && row.kind !== "video")
	) {
		return false;
	}

	return deleteFile({ deletedBy: userId, fileId, organizationId });
};

export class UploadRejectedError extends Error {}

export const registerUpload = async ({
	contentType: storedContentType,
	key,
	name,
	organizationId,
	purpose,
	sizeBytes,
	userId,
}: {
	contentType: string;
	key: string;
	name: string;
	organizationId: string;
	purpose: UploadPurpose;
	sizeBytes: number;
	userId: string;
}) => {
	const policy = uploadPolicies[purpose];
	const contentType = normalizeContentType(storedContentType);

	const kind = detectKind({
		extension: getExtensionFromFilename({ filename: name }) ?? undefined,
		mediaType: contentType,
	});

	const indexable = purpose === "knowledge";

	if (
		!policy.contentTypes.includes(contentType) ||
		(indexable && kind !== "image" && kind !== "document" && kind !== "text")
	) {
		throw new UploadRejectedError("Unsupported upload type.");
	}

	if (sizeBytes > policy.maxFileSizeMb * 1024 * 1024) {
		throw new UploadRejectedError("Uploaded file exceeds its size limit.");
	}

	const { created, file } = await createFile({
		access: policy.access,
		contentType,
		kind,
		name,
		organizationId,
		ragStatus: indexable ? "pending" : "none",
		sizeBytes,
		sourceType: "upload",
		storageKey: key,
		uploadedBy: userId,
	});

	if (indexable && created) {
		await startIngestFile({ fileId: file.id, organizationId });
	}

	return { id: file.id, url: await getFileUrl(file) };
};
