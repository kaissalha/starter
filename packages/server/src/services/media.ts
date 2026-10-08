import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { db, files } from "@starter/db";
import { mediaContentTypes, uploadPolicies } from "@starter/documents";

import { rankRelevantCandidates } from "../ai/relevance";
import { bindStockImageCandidate, getStockImage } from "../lib/stock-images";
import { requireOrganizationPermission } from "./permissions";
import { createFile, deleteFile } from "./storage";

export {
	searchStockImages,
	stockImageSearchInputSchema,
	stockImageSearchResultSchema,
	stockImageSelectInputSchema,
} from "../lib/stock-images";

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
			summary: files.summary,
			title: files.title,
			url: files.url,
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
	rows.flatMap(({ kind, metadata: _metadata, summary: _summary, title: _title, url, ...row }) =>
		(kind === "image" || kind === "video") && url ? [{ ...row, kind, url }] : []
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
			functionId: "media-semantic-search",
			query,
			text: ({ metadata, name, summary, title }) =>
				[title, name, summary, metadata.altText, metadata.ocrText].filter(Boolean).join("\n"),
		});

		return { items: projectUploadedMedia(ranked), nextOffset: null };
	}

	return { items: projectUploadedMedia(rows).slice(0, 30), nextOffset: rows.length > 30 ? offset + 30 : null };
};

export const getUploadedMedia = async ({ fileId, organizationId }: { fileId: string; organizationId: string }) => {
	const row = await db.query.files.findFirst({
		where: { access: "public", deletedAt: { isNull: true }, id: fileId, organizationId },
	});

	const parsed = uploadedMediaSchema.safeParse(row);

	if (
		!parsed.success ||
		!row ||
		!mediaContentTypes.includes(row.contentType) ||
		(row.sourceType !== "upload" && !(row.sourceType === "url" && row.metadata.stockImage))
	) {
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

export const selectStockImage = async ({
	id,
	organizationId,
	userId,
}: {
	id: string;
	organizationId: string;
	userId: string;
}) => {
	await requireOrganizationPermission({ organizationId, permission: "write", userId });
	const candidate = await getStockImage({ id });
	const asset = await bindStockImageCandidate({ candidate });

	const existing = await db.query.files.findFirst({
		where: { access: "public", deletedAt: { isNull: true }, organizationId, sourceType: "url", url: asset.src },
	});

	if (existing?.metadata.stockImage?.id === candidate.id) {
		return uploadedMediaSchema.parse(existing);
	}

	const { file } = await createFile({
		access: "public",
		contentType: "image/jpeg",
		kind: "image",
		metadata: {
			altText: candidate.alt,
			height: asset.height,
			stockImage: {
				id: candidate.id,
				provider: candidate.provider,
			},
			thumbnailUrl: candidate.thumbnailUrl,
			width: asset.width,
		},
		name: candidate.alt || candidate.id,
		organizationId,
		sourceType: "url",
		uploadedBy: userId,
		url: asset.src,
	});

	return uploadedMediaSchema.parse(file);
};

export const findUnownedMediaUrls = async ({
	organizationId,
	urls,
}: {
	organizationId: string;
	urls: Array<string>;
}) => {
	if (urls.length === 0) {
		return [];
	}

	const rows = await db
		.select({ url: files.url })
		.from(files)
		.where(
			and(
				eq(files.organizationId, organizationId),
				eq(files.access, "public"),
				inArray(files.kind, ["image", "video"]),
				isNull(files.deletedAt),
				inArray(files.url, urls)
			)
		);

	const owned = new Set(rows.map(({ url }) => url));

	return urls.filter((url) => !owned.has(url));
};
