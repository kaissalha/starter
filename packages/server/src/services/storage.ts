import { waitUntil } from "@vercel/functions";
import { and, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";

import {
	db,
	type FileAccess,
	type FileRecord,
	type FileKind,
	type FileMetadata,
	type FileRagStatus,
	type FileSourceType,
	fileTagAssignments,
	fileTags,
	files,
} from "@starter/db";
import { detectKind } from "@starter/documents";

import { deleteBlob, getPublicBlobUrl } from "../lib/blob-storage";

export const FILE_PROCESSING_FAILED_CODE = "PROCESSING_FAILED";

export const createFile = async (params: {
	access?: FileAccess;
	content?: string | null;
	contentHash?: string | null;
	contentType: string;
	kind?: FileKind;
	metadata?: FileMetadata;
	name: string;
	organizationId: string;
	ragStatus?: FileRagStatus;
	sizeBytes?: number | null;
	sourceType?: FileSourceType;
	storageKey?: string | null;
	uploadedBy?: string | null;
	versionGroupId?: string | null;
}) => {
	const [file] = await db
		.insert(files)
		.values({
			access: params.access ?? "public",
			content: params.content ?? null,
			contentHash: params.contentHash ?? null,
			contentType: params.contentType,
			kind: params.kind ?? detectKind({ mediaType: params.contentType }),
			metadata: params.metadata ?? {},
			name: params.name,
			organizationId: params.organizationId,
			ragStatus: params.ragStatus ?? "none",
			sizeBytes: params.sizeBytes ?? null,
			sourceType: params.sourceType ?? "upload",
			storageKey: params.storageKey ?? null,
			uploadedBy: params.uploadedBy ?? null,
			versionGroupId: params.versionGroupId ?? null,
		})
		.onConflictDoNothing({
			target: [files.organizationId, files.storageKey],
			where: sql`${files.storageKey} is not null and ${files.deletedAt} is null`,
		})
		.returning();

	if (file) {
		return { created: true, file };
	}

	const existing = params.storageKey
		? await db.query.files.findFirst({
				where: {
					deletedAt: { isNull: true },
					organizationId: params.organizationId,
					storageKey: params.storageKey,
				},
			})
		: undefined;

	if (!existing) {
		throw new Error("Failed to create file");
	}

	return { created: false, file: existing };
};

export const getFile = async ({ fileId, organizationId }: { fileId: string; organizationId: string }) => {
	const [file] = await db
		.select()
		.from(files)
		.where(and(eq(files.id, fileId), eq(files.organizationId, organizationId)))
		.limit(1);

	return file ?? null;
};

export const getFileUrl = async (file: Pick<FileRecord, "access" | "id" | "organizationId" | "storageKey">) => {
	if (!file.storageKey) {
		return null;
	}

	return file.access === "public"
		? getPublicBlobUrl(file.storageKey)
		: `/api/media?${new URLSearchParams({ fileId: file.id, organizationId: file.organizationId })}`;
};

const staleIngestAfterMs = 5 * 60 * 1000;

const abandonIngestAfterMs = 30 * 60 * 1000;

const activeIngestRunStatuses = new Set(["pending", "running", "waiting"]);

const restartStalledIngestRun = async (runId: string) => {
	const { mastra } = await import("../ai");
	const workflow = mastra.getWorkflow("ingestFileWorkflow");
	const state = await workflow.getWorkflowRunById(runId, { withNestedWorkflows: false });

	if (!state || !activeIngestRunStatuses.has(state.status)) {
		return false;
	}

	const run = await workflow.createRun({ runId });
	waitUntil(run.restart());

	return true;
};

const failStalePendingFiles = async ({
	fileIds,
	organizationId,
}: {
	fileIds?: Array<string>;
	organizationId: string;
}) => {
	const stale = await db
		.select({ createdAt: files.createdAt, id: files.id, ingestRunId: files.ingestRunId })
		.from(files)
		.where(
			and(
				eq(files.organizationId, organizationId),
				eq(files.ragStatus, "pending"),
				isNull(files.deletedAt),
				lt(files.updatedAt, new Date(Date.now() - staleIngestAfterMs).toISOString()),
				fileIds ? inArray(files.id, fileIds) : undefined
			)
		)
		.limit(50);

	await Promise.all(
		stale.map(async (file) => {
			if (file.ingestRunId && Date.parse(file.createdAt) > Date.now() - abandonIngestAfterMs) {
				try {
					if (await restartStalledIngestRun(file.ingestRunId)) {
						await db
							.update(files)
							.set({ updatedAt: new Date().toISOString() })
							.where(and(eq(files.id, file.id), eq(files.organizationId, organizationId)));

						return;
					}
				} catch {
					return;
				}
			}

			await db
				.update(files)
				.set({
					processingError: FILE_PROCESSING_FAILED_CODE,
					ragStatus: "failed",
					updatedAt: new Date().toISOString(),
				})
				.where(
					and(eq(files.id, file.id), eq(files.organizationId, organizationId), eq(files.ragStatus, "pending"))
				);
		})
	);
};

export const listKnowledgeDocuments = async ({
	offset,
	organizationId,
}: {
	offset: number;
	organizationId: string;
}) => {
	await failStalePendingFiles({ organizationId });

	const rows = await db
		.select({
			id: files.id,
			name: files.name,
			ragStatus: files.ragStatus,
			summary: files.summary,
			title: files.title,
		})
		.from(files)
		.where(and(eq(files.organizationId, organizationId), isNull(files.deletedAt), ne(files.ragStatus, "none")))
		.orderBy(desc(files.createdAt), desc(files.id))
		.limit(21)
		.offset(offset);

	return {
		documents: rows.slice(0, 20).map(({ summary, title, ...file }) => ({
			...file,
			summary: summary?.slice(0, 500) ?? null,
			title: title?.slice(0, 200) ?? null,
		})),
		nextOffset: rows.length > 20 ? offset + 20 : null,
	};
};

export const listRetrievableFileIds = async ({
	fileIds,
	organizationId,
}: {
	fileIds: Array<string>;
	organizationId: string;
}) => {
	const uniqueFileIds = Array.from(new Set(fileIds));

	if (uniqueFileIds.length === 0) {
		return [];
	}

	const rows = await db
		.select({ id: files.id })
		.from(files)
		.where(
			and(
				eq(files.organizationId, organizationId),
				inArray(files.id, uniqueFileIds),
				eq(files.ragStatus, "ready"),
				isNull(files.deletedAt)
			)
		);

	return rows.map(({ id }) => id);
};

export const deleteFile = async ({
	deletedBy = null,
	fileId,
	organizationId,
}: {
	deletedBy?: string | null;
	fileId: string;
	organizationId: string;
}) => {
	const file = await getFile({ fileId, organizationId });

	if (!file || file.deletedAt) {
		return false;
	}

	if (file.storageKey) {
		await deleteBlob({ access: file.access, key: file.storageKey });
	}

	const now = new Date().toISOString();

	const [deleted] = await db
		.update(files)
		.set({ deletedAt: now, deletedBy, updatedAt: now })
		.where(and(eq(files.id, fileId), eq(files.organizationId, organizationId), isNull(files.deletedAt)))
		.returning({ id: files.id });

	if (!deleted) {
		return false;
	}

	const { deleteKnowledgeFile } = await import("../ai/knowledge");
	await deleteKnowledgeFile({ fileId, organizationId });

	return true;
};

export const setFileRagStatus = async ({
	error = null,
	fileId,
	organizationId,
	status,
}: {
	error?: string | null;
	fileId: string;
	organizationId: string;
	status: FileRagStatus;
}) => {
	await db
		.update(files)
		.set({ processingError: error, ragStatus: status, updatedAt: new Date().toISOString() })
		.where(and(eq(files.id, fileId), eq(files.organizationId, organizationId)));
};

export const applyFileEnrichment = async ({
	docDate = null,
	fileId,
	language = null,
	metadataPatch,
	organizationId,
	summary = null,
	title = null,
}: {
	docDate?: string | null;
	fileId: string;
	language?: string | null;
	metadataPatch?: Partial<FileMetadata>;
	organizationId: string;
	summary?: string | null;
	title?: string | null;
}) => {
	await db
		.update(files)
		.set({
			docDate,
			language,
			metadata:
				metadataPatch && Object.keys(metadataPatch).length > 0
					? sql`${files.metadata} || ${JSON.stringify(metadataPatch)}::jsonb`
					: undefined,
			summary,
			title,
			updatedAt: new Date().toISOString(),
		})
		.where(and(eq(files.id, fileId), eq(files.organizationId, organizationId)));
};

export const upsertFileTags = async ({
	fileId,
	organizationId,
	tags,
}: {
	fileId: string;
	organizationId: string;
	tags: Array<string>;
}) => {
	for (const name of new Set(tags.map((tag) => tag.trim()).filter(Boolean))) {
		const slug = name
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/gu, "-")
			.replaceAll(/^-+|-+$/gu, "")
			.slice(0, 64);

		if (!slug) {
			continue;
		}

		const [tag] = await db
			.insert(fileTags)
			.values({ name, organizationId, slug })
			.onConflictDoUpdate({ set: { name }, target: [fileTags.organizationId, fileTags.slug] })
			.returning({ id: fileTags.id });

		if (tag) {
			await db.insert(fileTagAssignments).values({ fileId, organizationId, tagId: tag.id }).onConflictDoNothing();
		}
	}
};

const FILE_WAIT_INTERVAL_MS = 1500;

const FILE_WAIT_TIMEOUT_MS = 4.5 * 60 * 1000;

const delayFilePolling = ({ milliseconds, signal }: { milliseconds: number; signal?: AbortSignal }) =>
	new Promise<void>((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error("File wait cancelled"));

			return;
		}

		const handleAbort = () => {
			clearTimeout(timeoutId);
			reject(new Error("File wait cancelled"));
		};

		const timeoutId = setTimeout(() => {
			signal?.removeEventListener("abort", handleAbort);
			resolve();
		}, milliseconds);

		signal?.addEventListener("abort", handleAbort, { once: true });
	});

export const waitForFilesReady = async ({
	fileIds,
	organizationId,
	signal,
	timeoutMs = FILE_WAIT_TIMEOUT_MS,
}: {
	fileIds: Array<string>;
	organizationId: string;
	signal?: AbortSignal;
	timeoutMs?: number;
}) => {
	const uniqueFileIds = Array.from(new Set(fileIds));

	if (uniqueFileIds.length === 0) {
		return [];
	}

	const start = Date.now();

	while (Date.now() - start < timeoutMs) {
		if (signal?.aborted) {
			throw new Error("File wait cancelled");
		}

		await failStalePendingFiles({ fileIds: uniqueFileIds, organizationId });
		const rows = await Promise.all(uniqueFileIds.map((fileId) => getFile({ fileId, organizationId })));
		const missingIndex = rows.findIndex((row) => !row);

		if (missingIndex !== -1) {
			throw new Error(`File not found: ${uniqueFileIds[missingIndex]}`);
		}

		const failed = rows.find((row) => row?.ragStatus === "failed");

		if (failed) {
			throw new Error(`Failed to index ${failed.name}`);
		}

		if (rows.every((row) => row?.ragStatus === "ready" || row?.ragStatus === "none")) {
			return rows;
		}

		await delayFilePolling({ milliseconds: FILE_WAIT_INTERVAL_MS, signal });
	}

	throw new Error("Timed out waiting for attachments to finish indexing");
};
