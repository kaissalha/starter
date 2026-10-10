import { Agent } from "@mastra/core/agent";
import { Language, MDocument } from "@mastra/rag";
import { z } from "zod";

import type { FileMetadata } from "@starter/db";
import { getExtensionFromFilename, MAX_INGEST_TEXT_LENGTH, normalizeContentType } from "@starter/documents";
import { extractFileText } from "@starter/documents/extraction";
import { log } from "@starter/observability";

import { decisionClassifiers, evaluateDecision } from "../../ai/decisions";
import { models } from "../../ai/models";
import {
	documentCategoryQuestion,
	fileClassificationSchema,
	fileClassificationSystemPrompt,
	imageClassificationSchema,
	imageClassificationSystemPrompt,
} from "../../ai/prompts";
import { downloadBlob } from "../../lib/blob-storage";
import {
	applyFileEnrichment,
	FILE_PROCESSING_FAILED_CODE,
	getFile,
	setFileRagStatus,
	upsertFileTags,
} from "../../services/storage";

export const MAX_INGEST_CHUNKS = 300;

const startIndexSchema = z.compile(z.number().int().nonnegative());

const docDateSchema = z.compile(z.iso.date().regex(/^(?:19|20)\d{2}-/u));

export const documentClassifierAgent = new Agent({
	description: "Extracts untrusted document metadata for the knowledge library.",
	id: "document-classifier",
	instructions: fileClassificationSystemPrompt,
	model: models.cheapFast.model,
	name: "Document Classifier",
});

export const imageClassifierAgent = new Agent({
	description: "Extracts untrusted image metadata and visible text for the knowledge library.",
	id: "image-classifier",
	instructions: imageClassificationSystemPrompt,
	model: models.vision.model,
	name: "Image Classifier",
});

type FileClassification = {
	date: string | null;
	documentCategory?: FileMetadata["documentCategory"];
	language: string | null;
	ocrText: string | null;
	summary: string | null;
	tags: Array<string>;
	title: string | null;
};

export const loadIngestFile = async (fileId: string, organizationId: string) => {
	const file = await getFile({ fileId, organizationId });

	if (!file) {
		return null;
	}

	return {
		access: file.access,
		contentType: file.contentType,
		kind: file.kind,
		name: file.name,
		source: file.metadata.sourceUrl?.trim() || null,
		storageKey: file.storageKey,
	};
};

type IngestFile = NonNullable<Awaited<ReturnType<typeof loadIngestFile>>>;

export const extractDocumentText = async (file: IngestFile) => {
	if (!file.storageKey) {
		return { pages: [], text: "" };
	}

	const { body } = await downloadBlob({ access: file.access, key: file.storageKey });

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

const classificationTimeout = () => AbortSignal.timeout(120_000);

const documentCategoryMinimumCharacters = 400;

const sampleDocumentText = (text: string) =>
	text.length <= 4000 ? text : `${text.slice(0, 3000)}\n[…]\n${text.slice(-1000)}`;

export const classifyDocument = async ({ text }: { text: string }): Promise<FileClassification> => {
	const [generated, classification] = await Promise.all([
		documentClassifierAgent.generate(`<untrusted-document>\n${text.slice(0, 12_000)}\n</untrusted-document>`, {
			abortSignal: classificationTimeout(),
			modelSettings: { maxRetries: 2 },
			structuredOutput: { schema: fileClassificationSchema },
		}),
		text.trim().length < documentCategoryMinimumCharacters
			? null
			: evaluateDecision({
					classifier: decisionClassifiers.documentCategory,
					policy: "background",
					questions: { category: documentCategoryQuestion },
					state: sampleDocumentText(text),
				}),
	]);

	return {
		...generated.object,
		documentCategory: classification?.answers.category.choice ?? "unknown",
		ocrText: null,
	};
};

export const classifyImage = async ({ file }: { file: IngestFile }): Promise<FileClassification> => {
	if (!file.storageKey) {
		return { date: null, language: null, ocrText: null, summary: null, tags: [], title: file.name };
	}

	const { body } = await downloadBlob({ access: file.access, key: file.storageKey });

	const { object } = await imageClassifierAgent.generate(
		[
			{
				content: [
					{ text: "Analyze this image and extract metadata and any visible text.", type: "text" },
					{ data: new Uint8Array(body), mediaType: file.contentType, type: "file" },
				],
				role: "user",
			},
		],
		{
			abortSignal: classificationTimeout(),
			modelSettings: { maxRetries: 2 },
			structuredOutput: { schema: imageClassificationSchema },
		}
	);

	return object;
};

export const chunkContent = async ({
	contentType,
	pages = [],
	text,
}: {
	contentType?: string;
	pages?: Array<{ pageNumber: number; text: string }>;
	text: string;
}) => {
	if (text.length > MAX_INGEST_TEXT_LENGTH) {
		throw new Error("Document exceeds the ingestion text limit");
	}

	const chunks: Array<{ chunkIndex: number; content: string; id: string; pageNumber?: number; startChar?: number }> =
		[];

	const sections: Array<{ pageNumber?: number; text: string }> = pages.length ? pages : [{ text }];

	const markdown = contentType !== undefined && normalizeContentType(contentType) === "text/markdown";

	for (const section of sections) {
		const document = markdown ? MDocument.fromMarkdown(section.text) : MDocument.fromText(section.text);

		const pageChunks = await document.chunk({
			addStartIndex: true,
			language: markdown ? Language.MARKDOWN : undefined,
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

export const applyEnrichment = async ({
	classification,
	fileId,
	organizationId,
}: {
	classification: FileClassification;
	fileId: string;
	organizationId: string;
}) => {
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

export const markFailed = async ({
	cause,
	fileId,
	organizationId,
}: {
	cause: string;
	fileId: string;
	organizationId: string;
}) => {
	log.error({ cause, fileId, message: "File ingestion failed", organizationId });

	await setFileRagStatus({ error: FILE_PROCESSING_FAILED_CODE, fileId, organizationId, status: "failed" });
};
