import { describe, expect, it } from "vitest";

import { buildSectionReferences, referenceExcludedCategories } from "../scripts/section-references";
import { sectionStructureSchema } from "../src/behavior/specification";
import descriptions from "../src/reference/section-descriptions.json";
import { sectionReferenceEntries } from "../src/reference/section-references";
import { sectionDefinitions } from "../src/section-registry";

const eligible = sectionDefinitions.filter(({ category }) => !referenceExcludedCategories.has(category));

const maxReferenceCharacters = 10_000;

describe("catalog section references", () => {
	it("matches the committed artifact (stale? run `bun run --cwd packages/infinite-website generate:references`)", () => {
		expect(buildSectionReferences()).toEqual(sectionReferenceEntries);
	}, 30_000);

	it("covers every registered section with a description and every non-header/footer pattern with a reference", () => {
		expect(Object.keys(descriptions).toSorted()).toEqual(
			sectionDefinitions.map(({ pattern }) => pattern).toSorted()
		);
		expect(sectionReferenceEntries.map(({ pattern }) => pattern).toSorted()).toEqual(
			eligible.map(({ pattern }) => pattern).toSorted()
		);
		expect(sectionReferenceEntries.filter(({ category }) => referenceExcludedCategories.has(category))).toEqual([]);
	});

	it("validates against the composition structure once unsupported stubs become boxes", () => {
		const failures = sectionReferenceEntries.flatMap(({ pattern, reference }) => {
			const parsed = sectionStructureSchema.safeParse({
				nodes: reference.nodes.map((node) =>
					node.type === "unsupported" ? { children: [], key: node.key, props: {}, type: "box" } : node
				),
				root: reference.root,
			});

			return parsed.success ? [] : [pattern];
		});

		expect(failures).toEqual([]);
	});

	it("keeps every reference compact and anchored on a supported root", () => {
		const oversized = sectionReferenceEntries.filter(
			({ reference }) => JSON.stringify(reference).length > maxReferenceCharacters
		);

		expect(oversized.map(({ pattern }) => pattern)).toEqual([]);
		expect(
			sectionReferenceEntries.filter(
				({ reference }) => reference.nodes.find(({ key }) => key === reference.root)?.type === "unsupported"
			)
		).toEqual([]);
	});

	it("flattens carousels, tabs, disclosures, and embeds and stubs only nodes outside the grammar", () => {
		const nodes = sectionReferenceEntries.flatMap(({ reference }) => reference.nodes);
		const stubs = nodes.flatMap((node) => (node.type === "unsupported" ? [node.props.summary] : []));
		const types = new Set(nodes.map(({ type }) => type));

		expect(stubs.every((summary) => summary.startsWith("masonry"))).toBe(true);
		["carousel", "disclosure", "embed", "item", "tabs"].forEach((type) => expect(types.has(type)).toBe(true));
		expect(
			nodes.some(
				(node) => node.type === "embed" && "provider" in node.props && node.props.provider === "contact-form"
			)
		).toBe(true);
	});

	it("summarizes repeated children beyond the cap", () => {
		const entry = sectionReferenceEntries.find(({ pattern }) => pattern === "pricing-table");

		expect(entry?.reference.notes.length).toBeGreaterThan(0);
	});
});
