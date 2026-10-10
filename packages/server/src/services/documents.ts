import { createHash } from "node:crypto";
import { z } from "zod";

import { startIngestFile } from "../workflows/ingest-file";
import {
	createFile,
	FILE_PROCESSING_FAILED_CODE,
	getFile,
	getFileUrl,
	markFileFailed,
	setFileIngestRunId,
} from "./storage";

export const documentSchema = z.compile(
	z
		.object({
			access: z.enum(["public", "private"]),
			contentType: z.string(),
			createdAt: z.string(),
			id: z.uuid(),
			kind: z.enum(["document", "image", "text", "audio", "video", "other"]),
			name: z.string(),
			organizationId: z.string(),
			processingError: z.string().nullable(),
			ragStatus: z.enum(["none", "pending", "ready", "failed"]),
			sizeBytes: z.number().nullable(),
			sourceType: z.enum(["upload", "text", "url"]),
			summary: z.string().nullable(),
			title: z.string().nullable(),
			updatedAt: z.string(),
			url: z.string().nullable(),
		})
		.meta({ id: "Document" })
);

export const createDocumentResponseSchema = z.compile(
	z
		.object({
			document: documentSchema,
			runId: z.string(),
		})
		.meta({ id: "CreateDocumentResponse" })
);

export const toDocumentResponse = async (file: NonNullable<Awaited<ReturnType<typeof getFile>>>) => ({
	access: file.access,
	contentType: file.contentType,
	createdAt: file.createdAt,
	id: file.id,
	kind: file.kind,
	name: file.name,
	organizationId: file.organizationId,
	processingError: file.processingError ? FILE_PROCESSING_FAILED_CODE : null,
	ragStatus: file.ragStatus,
	sizeBytes: file.sizeBytes,
	sourceType: file.sourceType,
	summary: file.summary,
	title: file.title,
	updatedAt: file.updatedAt,
	url: await getFileUrl(file),
});

export const startFileIngestion = async (input: { fileId: string; organizationId: string; text?: string }) => {
	const { runId } = await (async () => {
		try {
			return await startIngestFile(input);
		} catch (error) {
			await markFileFailed({
				error: FILE_PROCESSING_FAILED_CODE,
				fileId: input.fileId,
				organizationId: input.organizationId,
			});
			throw error;
		}
	})();

	await setFileIngestRunId({ fileId: input.fileId, organizationId: input.organizationId, runId });

	return { runId };
};

export const createDocumentInputSchema = z.compile(
	z
		.strictObject({
			name: z.string().trim().min(1).max(500),
			source: z.string().trim().min(1).max(2000).optional(),
			text: z.string().trim().min(1).max(500_000),
		})
		.meta({ id: "CreateDocumentInput" })
);

export const createDocument = async ({
	input,
	organizationId,
	userId,
}: {
	input: z.infer<typeof createDocumentInputSchema>;
	organizationId: string;
	userId: string;
}) => {
	const { name, source, text } = input;

	const { file: fileRecord } = await createFile({
		contentHash: createHash("sha256").update(text).digest("hex"),
		contentType: "text/plain",
		kind: "text",
		metadata: source ? { sourceUrl: source } : {},
		name,
		organizationId,
		ragStatus: "pending",
		sourceType: "text",
		uploadedBy: userId,
	});

	const run = await startFileIngestion({ fileId: fileRecord.id, organizationId, text });

	return { document: await toDocumentResponse(fileRecord), runId: run.runId };
};
