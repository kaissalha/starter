import { writeFile } from "node:fs/promises";
import path from "node:path";

import { knowledgeEmbeddingDimensions } from "@starter/db/mastra";
import { sectionReferenceEntries } from "@starter/infinite-website/section-references";

import { knowledgeEmbeddingModel } from "../src/mastra/models";
import {
	embedSectionTexts,
	encodeSectionEmbedding,
	hashSectionDescriptor,
} from "../src/services/websites/section-reference-search";

const outputPath = path.resolve(
	import.meta.dirname,
	"../src/services/websites/section-reference-embeddings.generated.json"
);

const batchSize = 50;

const vectors = (
	await Promise.all(
		Array.from({ length: Math.ceil(sectionReferenceEntries.length / batchSize) }, (_, batch) =>
			embedSectionTexts({
				values: sectionReferenceEntries
					.slice(batch * batchSize, (batch + 1) * batchSize)
					.map(({ descriptor }) => descriptor),
			})
		)
	)
).flat();

await writeFile(
	outputPath,
	`${JSON.stringify({
		dimensions: knowledgeEmbeddingDimensions,
		entries: Object.fromEntries(
			sectionReferenceEntries.map(({ descriptor, pattern }, index) => [
				pattern,
				{ hash: hashSectionDescriptor(descriptor), vector: encodeSectionEmbedding(vectors[index] ?? []) },
			])
		),
		model: knowledgeEmbeddingModel.modelId,
	})}\n`
);

console.warn(`wrote ${path.relative(process.cwd(), outputPath)} (${sectionReferenceEntries.length} embeddings)`);
