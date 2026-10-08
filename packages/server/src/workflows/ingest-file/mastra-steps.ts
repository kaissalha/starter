import { generateText, Output } from "ai";

import { evaluateDecision } from "../../ai/decisions";
import {
	fileClassificationSchema,
	fileClassificationSystemPrompt,
	imageClassificationSchema,
	imageClassificationSystemPrompt,
	documentCategoryQuestion,
} from "../../ai/prompts";
import { downloadBlob } from "../../lib/blob-storage";
import { deleteKnowledgeFile, upsertKnowledgeChunks } from "../../mastra/knowledge";
import { models } from "../../mastra/models";
import type { FileClassification, IngestChunk, IngestFile } from "./steps";

const classificationTimeout = () => AbortSignal.timeout(120_000);

const documentCategoryMinimumCharacters = 400;

const sampleDocumentText = (text: string) =>
	text.length <= 4000 ? text : `${text.slice(0, 3000)}\n[…]\n${text.slice(-1000)}`;

export const classifyDocument = async ({
	text,
}: {
	organizationId: string;
	text: string;
}): Promise<FileClassification> => {
	"use step";

	const [generated, classification] = await Promise.all([
		generateText({
			abortSignal: classificationTimeout(),
			maxRetries: 2,
			model: models.cheapFast.model,
			output: Output.object({ schema: fileClassificationSchema }),
			prompt: `<untrusted-document>\n${text.slice(0, 12_000)}\n</untrusted-document>`,
			providerOptions: models.cheapFast.providerOptions,
			system: fileClassificationSystemPrompt,
		}),
		text.trim().length < documentCategoryMinimumCharacters
			? null
			: evaluateDecision({
					functionId: "document-category",
					memoize: true,
					policy: "background",
					questions: { category: documentCategoryQuestion },
					state: sampleDocumentText(text),
				}),
	]);

	return {
		...generated.output,
		documentCategory: classification?.answers.category.choice ?? "unknown",
		ocrText: null,
	};
};

export const classifyImage = async ({
	file,
}: {
	file: IngestFile;
	organizationId: string;
}): Promise<FileClassification> => {
	"use step";

	if (!file.url) {
		return { date: null, language: null, ocrText: null, summary: null, tags: [], title: file.name };
	}

	const { body } = await downloadBlob({ access: file.access, url: file.url });

	const { output } = await generateText({
		abortSignal: classificationTimeout(),
		maxRetries: 2,
		messages: [
			{
				content: [
					{ text: "Analyze this image and extract metadata and any visible text.", type: "text" },
					{ data: new Uint8Array(body), mediaType: file.contentType, type: "file" },
				],
				role: "user",
			},
		],
		model: models.vision.model,
		output: Output.object({ schema: imageClassificationSchema }),
		system: imageClassificationSystemPrompt,
	});

	return output;
};

export const clearChunks = async ({ fileId, organizationId }: { fileId: string; organizationId: string }) => {
	"use step";

	await deleteKnowledgeFile({ fileId, organizationId });
};

export const embedAndInsertChunks = async ({
	chunks,
	fileId,
	fileName,
	organizationId,
	source,
}: {
	chunks: Array<IngestChunk>;
	fileId: string;
	fileName: string;
	organizationId: string;
	source: string | null;
}) => {
	"use step";

	await upsertKnowledgeChunks({ chunks, fileId, fileName, organizationId, source });

	return chunks.length;
};
