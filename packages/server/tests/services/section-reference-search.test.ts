import { describe, expect, it } from "vitest";

import { knowledgeEmbeddingDimensions } from "@starter/db/mastra";
import { sectionReferenceEntries } from "@starter/infinite-website/section-references";

import { knowledgeEmbeddingModel } from "../../src/mastra/models";
import {
	decodeSectionEmbedding,
	encodeSectionEmbedding,
	rankSectionReferences,
	sectionReferenceEmbeddingCommand,
	sectionReferenceEmbeddingStatus,
	selectDiverseReferences,
} from "../../src/services/websites/section-reference-search";

const entry = (pattern: string) => {
	const found = sectionReferenceEntries.find((candidate) => candidate.pattern === pattern);

	if (!found) {
		throw new Error(`Missing section reference ${pattern}`);
	}

	return found;
};

describe("section reference embeddings", () => {
	it(`are generated for the current descriptors and embedding model (stale? run \`${sectionReferenceEmbeddingCommand}\`)`, () => {
		expect(sectionReferenceEmbeddingStatus.stale).toEqual([]);
		expect(sectionReferenceEmbeddingStatus.unknown).toEqual([]);
		expect(sectionReferenceEmbeddingStatus.model).toBe(knowledgeEmbeddingModel.modelId);
		expect(sectionReferenceEmbeddingStatus.dimensions).toBe(knowledgeEmbeddingDimensions);
	});

	it("retrieve each pattern from its own embedding", () => {
		const failures = sectionReferenceEntries.filter(({ pattern }) => {
			const vector = sectionReferenceEmbeddingStatus.vectors.get(pattern) ?? [];

			const { ranked } = rankSectionReferences({
				candidates: sectionReferenceEntries,
				query: pattern,
				queryVector: vector,
			});

			return ranked[0]?.entry.pattern !== pattern;
		});

		expect(failures.map(({ pattern }) => pattern)).toEqual([]);
	});

	it("round-trips quantized vectors without losing direction", () => {
		const decoded = decodeSectionEmbedding(encodeSectionEmbedding([0.2, -0.4, 0.1, 0.8]));

		expect(decoded[3]).toBeGreaterThan(decoded[0] ?? 0);
		expect(decoded[1]).toBeLessThan(0);
		expect(Math.hypot(...decoded)).toBeCloseTo(1, 5);
	});

	it("returns nothing when no pattern is similar enough", () => {
		const unrelated = Array.from({ length: knowledgeEmbeddingDimensions }, (_, index) =>
			index % 2 === 0 ? 1 : -1
		);

		expect(
			rankSectionReferences({ candidates: sectionReferenceEntries, query: "x", queryVector: unrelated }).ranked
		).toEqual([]);
	});

	it("falls back to keyword scoring without a query vector", () => {
		const found = rankSectionReferences({
			candidates: sectionReferenceEntries,
			query: "frequently asked questions accordion",
		});

		const none = rankSectionReferences({ candidates: sectionReferenceEntries, query: "zzz qqq" });

		expect(found.method).toBe("keyword");
		expect(found.ranked[0]?.entry.category).toBe("faq");
		expect(none.ranked).toEqual([]);
	});

	it("selects one reference per family before filling", () => {
		const ranked = ["pricing-table", "pricing-table-2", "pricing-table-3", "pricing-editorial-highlight"].map(
			(pattern, index) => ({ entry: entry(pattern), score: 0.9 - index / 100 })
		);

		expect(selectDiverseReferences({ ranked }).map(({ entry: { pattern } }) => pattern)).toEqual([
			"pricing-table",
			"pricing-editorial-highlight",
		]);
		expect(selectDiverseReferences({ ranked: ranked.slice(0, 1) })).toHaveLength(1);
	});
});
