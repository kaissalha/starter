import { MDocument } from "@mastra/rag";
import { z } from "zod";

import type { FileMetadata } from "@starter/db";
import { getExtensionFromFilename, MAX_INGEST_TEXT_LENGTH } from "@starter/documents";
import { extractFileText } from "@starter/documents/extraction";
import { log } from "@starter/observability";

import { FILE_PROCESSING_FAILED_CODE, MAX_INGEST_CHUNKS } from "../../constants/upload";
import { downloadBlob } from "../../lib/blob-storage";
import { applyFileEnrichment, getFile, markFileFailed, markFileReady, upsertFileTags } from "../../services/storage";

const startIndexSchema = z.compile(z.number().int().nonnegative());

const docDateSchema = z.compile(z.iso.date().regex(/^(?:19|20)\d{2}-/u));

export type IngestFile = {
	access: "public" | "private";
	contentType: string;
	kind: "audio" | "document" | "image" | "other" | "text" | "video";
	name: string;
	source: string | null;
	url: string | null;
};

export type FileClassification = {
	date: string | null;
	documentCategory?: FileMetadata["documentCategory"];
	language: string | null;
	ocrText: string | null;
	summary: string | null;
	tags: Array<string>;
	title: string | null;
};

export const loadIngestFile = async (fileId: string, organizationId: string): Promise<IngestFile | null> => {
	"use step";

	const file = await getFile({ fileId, organizationId });

	if (!file) {
		return null;
	}

	return {
		access: file.access,
		contentType: file.contentType,
		kind: file.kind,
		name: file.name,
		source: file.metadata.sourceUrl?.trim() || file.url,
		url: file.url,
	};
};

export const extractDocumentText = async (file: IngestFile) => {
	"use step";

	if (!file.url) {
		return { pages: [], text: "" };
	}

	const { body } = await downloadBlob({ access: file.access, url: file.url });

	const extracted = await extractFileText({
		buffer: body,
		extension: getExtensionFromFilename({ filename: file.name }) ?? "",
		mimeType: file.contentType,
	});

	return {
		pages: extracted.pages.map(({ pageNumber, text }) => ({ pageNumber, text: text.trim() })),
		text: extracted.text.trim(),
	};
};

export const chunkContent = async ({
	pages = [],
	text,
}: {
	pages?: Array<{ pageNumber: number; text: string }>;
	text: string;
}) => {
	"use step";

	if (text.length > MAX_INGEST_TEXT_LENGTH) {
		throw new Error("Document exceeds the ingestion text limit");
	}

	const chunks: Array<{ chunkIndex: number; content: string; id: string; pageNumber?: number; startChar?: number }> =
		[];

	const sections: Array<{ pageNumber?: number; text: string }> = pages.length ? pages : [{ text }];

	for (const section of sections) {
		const pageChunks = await MDocument.fromText(section.text).chunk({
			addStartIndex: true,
			maxSize: 2000,
			overlap: 200,
			strategy: "recursive",
		});

		for (const chunk of pageChunks) {
			if (chunks.length >= MAX_INGEST_CHUNKS) {
				throw new Error("Document exceeds the ingestion chunk limit");
			}

			chunks.push({
				chunkIndex: chunks.length,
				content: chunk.text,
				id: chunk.id_,
				pageNumber: section.pageNumber,
				startChar: startIndexSchema.safeParse(chunk.metadata.startIndex).data,
			});
		}
	}

	return chunks;
};

export type IngestChunk = Awaited<ReturnType<typeof chunkContent>>[number];

export const applyEnrichment = async ({
	classification,
	fileId,
	organizationId,
}: {
	classification: FileClassification;
	fileId: string;
	organizationId: string;
}) => {
	"use step";

	await applyFileEnrichment({
		docDate: docDateSchema.safeParse(classification.date).data ?? null,
		fileId,
		language: classification.language?.trim().slice(0, 64) || null,
		metadataPatch: {
			documentCategory: classification.documentCategory,
			ocrText: classification.ocrText?.slice(0, 100_000) ?? undefined,
		},
		organizationId,
		summary: classification.summary?.slice(0, 2000) ?? null,
		title: classification.title?.trim().slice(0, 500) || null,
	});

	if (classification.tags.length > 0) {
		await upsertFileTags({
			fileId,
			organizationId,
			tags: classification.tags.slice(0, 6).map((tag) => tag.slice(0, 64)),
		});
	}
};

export const markReady = async ({ fileId, organizationId }: { fileId: string; organizationId: string }) => {
	"use step";

	await markFileReady({ fileId, organizationId });
};

export const markFailed = async ({
	cause,
	fileId,
	organizationId,
}: {
	cause: string;
	fileId: string;
	organizationId: string;
}) => {
	"use step";

	log.error({ cause, fileId, message: "File ingestion failed", organizationId });

	await markFileFailed({ error: FILE_PROCESSING_FAILED_CODE, fileId, organizationId });
};
