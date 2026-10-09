import { decisionClassifiers, evaluateDecision } from "../../ai/decisions";
import { documentCategoryQuestion, fileClassificationSchema, imageClassificationSchema } from "../../ai/prompts";
import { downloadBlob } from "../../lib/blob-storage";
import { deleteKnowledgeFile, upsertKnowledgeChunks } from "../../mastra/knowledge";
import { models } from "../../mastra/models";
import { documentClassifierAgent, imageClassifierAgent } from "./agents";
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
	const [generated, classification] = await Promise.all([
		documentClassifierAgent.generate(`<untrusted-document>\n${text.slice(0, 12_000)}\n</untrusted-document>`, {
			abortSignal: classificationTimeout(),
			modelSettings: { maxRetries: 2 },
			providerOptions: models.cheapFast.providerOptions,
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

export const classifyImage = async ({
	file,
}: {
	file: IngestFile;
	organizationId: string;
}): Promise<FileClassification> => {
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

export const clearChunks = async ({ fileId, organizationId }: { fileId: string; organizationId: string }) => {
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
	await upsertKnowledgeChunks({ chunks, fileId, fileName, organizationId, source });

	return chunks.length;
};
