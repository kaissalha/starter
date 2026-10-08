import { describe, expect, it } from "vitest";

import {
	blockingSectionDiagnostics,
	diagnoseComposedSection,
	sectionDiagnosticCodes,
	type ComposedSectionSpecification,
} from "../src/editing";

const repeated = "The same 50 unit and 10% paragraph intentionally appears in two different places.";

const longBody = "A".repeat(2001);

const candidate = {
	content: {
		ar: {
			alt: "صورة",
			body: longBody,
			"field-label": "الحقل",
			"heading-one": repeated,
			"heading-three": "عنوان فرعي",
			"heading-two": repeated,
			repeated,
			"repeated-again": repeated,
			"result-unavailable": "غير متاح",
			"secondary-unavailable": "غير متاح",
			"trigger-label": "تشغيل",
			wrong: "English only",
		},
		assets: { asset: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d399" },
		en: {
			alt: "Photo",
			body: longBody,
			"field-label": "Field",
			"heading-one": repeated,
			"heading-three": "Subheading",
			"heading-two": repeated,
			repeated,
			"repeated-again": repeated,
			"result-unavailable": "Unavailable",
			"secondary-unavailable": "Unavailable",
			"trigger-label": "Run",
			wrong: "عربي فقط",
		},
	},
	structure: {
		nodes: [
			{
				children: [
					"heading-one",
					"heading-two",
					"heading-three",
					"body",
					"repeated",
					"repeated-again",
					"wrong",
					"media",
					"field",
					"result-group",
				],
				key: "surface",
				props: {
					columns: 2,
					padding: { blockEnd: "7rem", blockStart: "7rem" },
				},
				type: "grid" as const,
			},
			...(["heading-one", "heading-two"] as const).map((key) => ({
				children: [],
				key,
				props: { content: key, element: "h1" as const },
				type: "text" as const,
			})),
			{
				children: [],
				key: "heading-three",
				props: { content: "heading-three", element: "h3" as const },
				type: "text" as const,
			},
			{
				children: [],
				key: "body",
				props: { content: "body", inlineSize: "100vw" },
				type: "text" as const,
			},
			...(["repeated", "repeated-again", "wrong"] as const).map((key) => ({
				children: [],
				key,
				props: { content: key },
				type: "text" as const,
			})),
			{
				children: [],
				key: "media",
				props: { alt: "alt", asset: "asset" },
				type: "media" as const,
			},
			{
				children: ["field-label"],
				key: "field",
				props: { slot: "amount" },
				type: "field" as const,
			},
			{
				children: [],
				key: "field-label",
				props: { content: "field-label" },
				type: "text" as const,
			},
			{ children: ["result", "secondary-result"], key: "result-group", props: {}, type: "box" as const },
			{
				children: [],
				key: "result",
				props: { format: { style: "decimal" }, output: "result", unavailable: "result-unavailable" },
				type: "value" as const,
			},
			{
				children: [],
				key: "secondary-result",
				props: { format: { style: "decimal" }, output: "secondary", unavailable: "secondary-unavailable" },
				type: "value" as const,
			},
		],
		root: "surface",
	},
} satisfies Pick<ComposedSectionSpecification, "content" | "structure">;

const layoutCandidate = {
	content: {
		ar: { alt: "غرفة الاجتماعات", copy: "نص", cta: "ابدأ", title: "عنوان" },
		assets: { asset: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d399" },
		en: { alt: "Meeting room", copy: "Text", cta: "Start", title: "Title" },
	},
	structure: {
		nodes: [
			{
				children: ["hero", "columns", "banner", "tiles"],
				key: "surface",
				props: { padding: { blockEnd: "6sp", blockStart: "6sp" } },
				type: "box" as const,
			},
			{
				children: ["photo", "overlaid"],
				key: "hero",
				props: {},
				type: "box" as const,
			},
			{
				children: [],
				key: "photo",
				props: { alt: "alt", asset: "asset", position: "absolute" },
				type: "media" as const,
			},
			{ children: [], key: "overlaid", props: { content: "title", tone: "primary" }, type: "text" as const },
			{
				children: ["cell-a", "cell-b", "cell-c"],
				key: "columns",
				props: { columns: 3, gap: "4px" },
				type: "grid" as const,
			},
			...(["cell-a", "cell-b", "cell-c"] as const).map((key) => ({
				children: [],
				key,
				props: { content: "copy" },
				type: "text" as const,
			})),
			{ children: ["banner-copy"], key: "banner", props: { fill: "action" }, type: "box" as const },
			{ children: [], key: "banner-copy", props: { content: "cta", tone: "primary" }, type: "text" as const },
			{
				children: ["tile-1", "tile-2", "tile-3", "tile-4", "tile-5", "tile-6"],
				key: "tiles",
				props: {},
				type: "box" as const,
			},
			...([1, 2, 3, 4, 5, 6] as const).flatMap((index) => [
				{
					children: [`tile-${index}-copy`],
					key: `tile-${index}`,
					props: { fill: "subtle" },
					type: "box" as const,
				},
				{ children: [], key: `tile-${index}-copy`, props: { content: "copy" }, type: "text" as const },
			]),
		],
		root: "surface",
	},
} satisfies Pick<ComposedSectionSpecification, "content" | "structure">;

describe("composed section diagnostics", () => {
	it("reports the layout, tone, protection, spacing and repetition rules with located keys", () => {
		const diagnostics = diagnoseComposedSection(layoutCandidate);
		const byCode = (code: string) => diagnostics.find((entry) => entry.code === code);

		expect(byCode("column-overflow")).toMatchObject({ nodeKeys: ["columns"], severity: "blocking" });
		expect(byCode("on-fill-tone")).toMatchObject({ nodeKeys: ["banner", "banner-copy"], severity: "soft" });
		expect(byCode("unprotected-media-text")).toMatchObject({ nodeKeys: ["photo", "overlaid"], severity: "soft" });
		expect(byCode("off-scale-spacing")?.nodeKeys).toEqual(["columns"]);
		expect(byCode("repeated-structure")?.nodeKeys).toHaveLength(7);
		expect(blockingSectionDiagnostics(diagnostics).map(({ code }) => code)).toEqual(["column-overflow"]);
	});

	it("accepts responsive columns, protected media, matching tones and sp spacing", () => {
		const nodes = layoutCandidate.structure.nodes.map((node) => {
			if (node.key === "columns") {
				return { ...node, props: { columns: { base: 1, compact: 3 }, gap: "4sp" } };
			}

			if (node.key === "photo") {
				return { ...node, props: { ...node.props, overlay: { kind: "scrim", strength: "medium" } } };
			}

			return node.key === "banner-copy" ? { ...node, props: { content: "cta", tone: "action" } } : node;
		});

		const codes = diagnoseComposedSection({
			content: layoutCandidate.content,
			structure: { nodes: nodes.slice(0, 11), root: "surface" },
		}).map(({ code }) => code);

		expect(codes).not.toContain("column-overflow");
		expect(codes).not.toContain("unprotected-media-text");
		expect(codes).not.toContain("on-fill-tone");
		expect(codes).not.toContain("off-scale-spacing");
	});

	it("reports every deterministic semantic and design warning class", () => {
		const diagnostics = diagnoseComposedSection(candidate);

		expect(new Set([...diagnostics, ...diagnoseComposedSection(layoutCandidate)].map(({ code }) => code))).toEqual(
			new Set(sectionDiagnosticCodes)
		);
		expect(diagnoseComposedSection(candidate)).toEqual(diagnostics);
		expect(diagnostics.every(({ contentKeys, nodeKeys }) => contentKeys.length > 0 || nodeKeys.length > 0)).toBe(
			true
		);
	});

	it("returns no warnings for a compact, accessible section", () => {
		expect(
			diagnoseComposedSection({
				content: { ar: { heading: "الخدمات" }, en: { heading: "Services" } },
				structure: {
					nodes: [
						{ children: ["heading"], key: "surface", props: {}, type: "box" },
						{
							children: [],
							key: "heading",
							props: { content: "heading", element: "h2" },
							type: "text",
						},
					],
					root: "surface",
				},
			})
		).toEqual([]);
	});

	it.each([
		["17sp", true],
		["16sp", false],
		["96px", false],
		["97px", true],
	])("measures spacing units in utility root padding: %s", (blockStart, flagged) => {
		const codes = diagnoseComposedSection({
			content: { ar: { field: "حقل", heading: "الخدمات" }, en: { field: "Field", heading: "Services" } },
			structure: {
				nodes: [
					{ children: ["field"], key: "surface", props: { padding: { blockStart } }, type: "box" },
					{ children: ["field-label"], key: "field", props: { slot: "amount" }, type: "field" },
					{ children: [], key: "field-label", props: { content: "field" }, type: "text" },
				],
				root: "surface",
			},
		}).map(({ code }) => code);

		expect(codes.includes("excessive-section-spacing")).toBe(flagged);
	});

	it("measures spacing units in inline sizes", () => {
		const codes = (inlineSize: string) =>
			diagnoseComposedSection({
				content: { ar: { heading: "الخدمات" }, en: { heading: "Services" } },
				structure: {
					nodes: [
						{ children: ["heading"], key: "surface", props: { inlineSize }, type: "box" },
						{ children: [], key: "heading", props: { content: "heading", element: "h2" }, type: "text" },
					],
					root: "surface",
				},
			}).map(({ code }) => code);

		expect(codes("241sp")).toContain("overflow-prone-size");
		expect(codes("240sp")).not.toContain("overflow-prone-size");
	});

	it("reports reordered copy that substantially repeats another text block", () => {
		const diagnostics = diagnoseComposedSection({
			content: {
				ar: {
					first: "قهوة محمصة طازجة يتم توصيلها إلى مكتبك كل أسبوع.",
					second: "يتم توصيل القهوة الطازجة المحمصة أسبوعيًا إلى مكتبك.",
				},
				en: {
					first: "Fresh roasted coffee delivered to your office every week.",
					second: "Roasted coffee delivered fresh to the office weekly.",
				},
			},
			structure: {
				nodes: [
					{ children: ["first", "second"], key: "surface", props: {}, type: "box" },
					{ children: [], key: "first", props: { content: "first" }, type: "text" },
					{ children: [], key: "second", props: { content: "second" }, type: "text" },
				],
				root: "surface",
			},
		});

		expect(diagnostics).toContainEqual(
			expect.objectContaining({ code: "overlapping-copy", contentKeys: ["first", "second"] })
		);
	});
});
