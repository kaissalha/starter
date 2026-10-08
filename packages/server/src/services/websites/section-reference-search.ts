import { createHash } from "node:crypto";
import { z } from "zod";

import { sectionReferenceEntries, type SectionReferenceEntry } from "@starter/infinite-website/section-references";

import { knowledgeEmbeddingModel, knowledgeEmbeddingProviderOptions } from "../../mastra/models";
import embeddingArtifact from "./section-reference-embeddings.generated.json";

export const sectionReferenceEmbeddingCommand = "bun run --cwd packages/server generate:section-embeddings";

const embeddingArtifactSchema = z.compile(
	z.strictObject({
		dimensions: z.number().int().nonnegative(),
		entries: z.record(z.string(), z.strictObject({ hash: z.string(), vector: z.string() })),
		model: z.string(),
	})
);

const artifact = embeddingArtifactSchema.parse(embeddingArtifact);

export const hashSectionDescriptor = (descriptor: string) =>
	createHash("sha256").update(descriptor).digest("hex").slice(0, 16);

export const embedSectionTexts = async ({
	abortSignal,
	values,
}: {
	abortSignal?: AbortSignal;
	values: Array<string>;
}) => {
	const { embeddings } = await knowledgeEmbeddingModel.doEmbed({
		abortSignal,
		providerOptions: knowledgeEmbeddingProviderOptions,
		values,
	});

	return embeddings;
};

export const encodeSectionEmbedding = (vector: Array<number>) => {
	const peak = Math.max(...vector.map(Math.abs)) || 1;

	return Buffer.from(Int8Array.from(vector, (value) => Math.round((value / peak) * 127))).toString("base64");
};

export const decodeSectionEmbedding = (encoded: string) => {
	const values = Array.from(new Int8Array(Buffer.from(encoded, "base64")));
	const norm = Math.hypot(...values) || 1;

	return values.map((value) => value / norm);
};

const storedVectors = new Map(
	sectionReferenceEntries.flatMap(({ descriptor, pattern }) => {
		const stored = artifact.entries[pattern];

		return stored?.hash === hashSectionDescriptor(descriptor)
			? [[pattern, decodeSectionEmbedding(stored.vector)]]
			: [];
	})
);

export const sectionReferenceEmbeddingStatus = {
	dimensions: artifact.dimensions,
	fresh: storedVectors.size === sectionReferenceEntries.length,
	model: artifact.model,
	stale: sectionReferenceEntries.filter(({ pattern }) => !storedVectors.has(pattern)).map(({ pattern }) => pattern),
	unknown: Object.keys(artifact.entries).filter(
		(pattern) => !sectionReferenceEntries.some((entry) => entry.pattern === pattern)
	),
	vectors: storedVectors,
};

const stopWords = new Set([
	"about",
	"add",
	"and",
	"are",
	"for",
	"from",
	"have",
	"into",
	"need",
	"new",
	"our",
	"page",
	"section",
	"site",
	"that",
	"the",
	"this",
	"want",
	"website",
	"with",
	"you",
	"your",
]);

const tokenize = (text: string) => [
	...new Set(
		(text.toLowerCase().match(/[a-z0-9]+/gu) ?? [])
			.map((token) => token.replace(/(?:ies|es|s)$/u, ""))
			.filter((token) => token.length > 2 && !stopWords.has(token))
	),
];

export type SectionReferenceMatch = { entry: SectionReferenceEntry; score: number };

const dot = (left: Array<number>, right: Array<number>) =>
	left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);

const scoreSemantically = ({
	candidates,
	queryVector,
}: {
	candidates: Array<SectionReferenceEntry>;
	queryVector: Array<number>;
}) => {
	const norm = Math.hypot(...queryVector) || 1;
	const query = queryVector.map((value) => value / norm);
	const scored = candidates.map((entry) => ({ entry, vector: storedVectors.get(entry.pattern) }));

	return scored.every(({ vector }) => vector)
		? scored.map(({ entry, vector }) => ({ entry, score: dot(query, vector ?? []) }))
		: null;
};

const scoreByKeywords = ({ candidates, query }: { candidates: Array<SectionReferenceEntry>; query: string }) => {
	const documents = candidates.map((entry) => ({
		entry,
		tokens: new Set(tokenize(`${entry.descriptor} ${entry.tags.join(" ")}`)),
	}));

	const weights = tokenize(query).flatMap((token) => {
		const frequency = documents.filter(({ tokens }) => tokens.has(token)).length;

		return frequency === 0 ? [] : [{ token, weight: Math.log(1 + documents.length / frequency) }];
	});

	const total = weights.reduce((sum, { weight }) => sum + weight, 0) || 1;

	return documents.map(({ entry, tokens }) => ({
		entry,
		score: weights.reduce((sum, { token, weight }) => sum + (tokens.has(token) ? weight : 0), 0) / total,
	}));
};

export const semanticMinimumScore = 0.62;

export const keywordMinimumScore = 0.5;

const relevanceWindow = 0.1;

export const rankSectionReferences = ({
	candidates,
	query,
	queryVector,
}: {
	candidates: Array<SectionReferenceEntry>;
	query: string;
	queryVector?: Array<number>;
}) => {
	const semantic = queryVector ? scoreSemantically({ candidates, queryVector }) : null;
	const method = semantic ? ("semantic" as const) : ("keyword" as const);
	const minimum = semantic ? semanticMinimumScore : keywordMinimumScore;

	const sorted = (semantic ?? scoreByKeywords({ candidates, query }))
		.filter(({ score }) => score >= minimum)
		.toSorted((left, right) => right.score - left.score || left.entry.pattern.localeCompare(right.entry.pattern));

	const top = sorted[0]?.score ?? 0;

	return { method, ranked: sorted.filter(({ score }) => score >= top - relevanceWindow) };
};

export const sectionReferenceFamily = (pattern: string) =>
	pattern.replace(/-\d+$/u, "").split("-").slice(0, 2).join("-");

export const selectDiverseReferences = ({
	limit = 3,
	minimum = 2,
	ranked,
}: {
	limit?: number;
	minimum?: number;
	ranked: Array<SectionReferenceMatch>;
}) => {
	const families = new Set<string>();

	const distinct = ranked
		.filter(({ entry }) => {
			const family = sectionReferenceFamily(entry.pattern);

			return families.has(family) ? false : Boolean(families.add(family));
		})
		.slice(0, limit);

	const fillers = ranked
		.filter((match) => !distinct.includes(match))
		.slice(0, Math.max(0, minimum - distinct.length));

	return [...distinct, ...fillers];
};
