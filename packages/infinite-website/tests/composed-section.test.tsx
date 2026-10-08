import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	SiteRenderer,
	createWebsiteSectionPreviewDocument,
	entityIdFromSeed,
	instantiateTemplate,
	validateSiteDocument,
} from "@starter/infinite-website";
import {
	composedSectionSpecificationSchema,
	editWebsiteSnapshot,
	inspectComposedSection,
	inspectSectionLogic,
	listWebsiteSectionLayouts,
	prepareWebsiteEditInputs,
	sectionAuthoringReference,
	sectionLogicAuthoringSchema,
	sectionLogicSchema,
	sectionStructureSchema,
	websiteEditInputSchema,
	WebsiteEditError,
	type SectionLogic,
} from "@starter/infinite-website/editing";
import { SitePreviewRenderer } from "@starter/infinite-website/preview";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

import { evaluateSiteScript, evaluateSiteScriptInteraction } from "../src/behavior/custom-script";
import { evaluateSiteBehavior } from "../src/behavior/runtime";
import { jsonObjectSchema, type JsonValue } from "../src/document/content-schema";
import { listSectionTextNodeReferences } from "../src/document/section-content-references";
import { siteDocumentResourceLimits } from "../src/resource-limits";
import { testBrand } from "./fixtures/brand";

const resultFormat = { maximumFractionDigits: 2, style: "decimal" as const };

const frameLayout = {
	inlineSize: "full",
	margin: { inlineEnd: "auto", inlineStart: "auto" },
	maxInlineSize: "96rem",
	padding: {
		blockEnd: "5rem",
		blockStart: "5rem",
		inlineEnd: "1.5rem",
		inlineStart: "1.5rem",
	},
};

const createStructure = (fieldKeys: Array<string>, outputKeys = ["result"]) => ({
	nodes: [
		{ children: ["frame"], key: "surface", props: { fill: "tint" }, type: "box" as const },
		{
			children: ["intro", "controls"],
			key: "frame",
			props: { ...frameLayout, columns: { base: 1, medium: 2 }, gap: "2rem" },
			type: "grid" as const,
		},
		{
			children: ["heading", "description"],
			key: "intro",
			props: { direction: "column", gap: "1rem" },
			type: "flex" as const,
		},
		{ children: [], key: "heading", props: { content: "heading", element: "h2" }, type: "text" as const },
		{
			children: [],
			key: "description",
			props: { content: "description", element: "p" },
			type: "text" as const,
		},
		{
			children: [...fieldKeys.map((key) => `${key}-field`), ...outputKeys.map((key) => `${key}-value`)],
			key: "controls",
			props: { direction: "column", gap: "1rem" },
			type: "flex" as const,
		},
		...fieldKeys.flatMap((key) => [
			{
				children: [`${key}-label`],
				key: `${key}-field`,
				props: { invalid: `${key}-invalid`, placeholder: `${key}-placeholder`, slot: key },
				type: "field" as const,
			},
			{
				children: [],
				key: `${key}-label`,
				props: { content: `${key}-label`, element: "span" },
				type: "text" as const,
			},
		]),
		...outputKeys.flatMap((key) => [
			{
				children: [`${key}-value-label`],
				key: `${key}-value`,
				props: { format: resultFormat, output: key, unavailable: `${key}-unavailable` },
				type: "value" as const,
			},
			{
				children: [],
				key: `${key}-value-label`,
				props: { content: `${key}-value-label`, element: "span" },
				type: "text" as const,
			},
		]),
	],
	root: "surface",
});

const createContent = (fieldKeys: Array<string>, outputKeys = ["result"]) => {
	const entries = (labels: Record<string, string>) => ({
		description: labels.description!,
		heading: labels.heading!,
		...Object.fromEntries(
			fieldKeys.flatMap((key) => [
				[`${key}-label`, key],
				[`${key}-invalid`, labels.invalid!],
				[`${key}-placeholder`, "0.1"],
			])
		),
		...Object.fromEntries(
			outputKeys.flatMap((key) => [
				[`${key}-value-label`, labels.total!],
				[`${key}-unavailable`, labels.unavailable!],
			])
		),
	});

	return {
		ar: entries({
			description: "تقدير لأغراض التخطيط.",
			heading: "تقدير فوري",
			invalid: "أدخل رقمًا عشريًا صالحًا",
			total: "الإجمالي",
			unavailable: "غير متاح",
		}),
		en: entries({
			description: "A planning estimate.",
			heading: "Instant estimate",
			invalid: "Enter a valid decimal",
			total: "Total",
			unavailable: "Unavailable",
		}),
	};
};

const expressionLogic: SectionLogic = {
	expression: "base + extra",
	fields: [
		{ initial: "0.1", key: "base" },
		{ initial: "0.2", key: "extra" },
	],
	kind: "expression",
};

const specification = {
	content: createContent(["base", "extra"]),
	logic: expressionLogic,
	structure: createStructure(["base", "extra"]),
};

const createSnapshot = () => ({
	assets: {},
	brand: testBrand,
	document: instantiateTemplate({
		content: nordicEdgeContent,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `composed-section:${kind}:${path}` }),
		definition: nordicEdgeTemplate,
		path: "/composed-section",
	}),
	schemaVersion: 1 as const,
	templateId: "nordic-edge",
});

const addSpecification = (overrides: Partial<typeof specification> = {}, seedSuffix = "d335") => ({
	index: 0,
	operation: "add-composed-section" as const,
	pageId: createSnapshot().document.structure.pages[0]!.id,
	seed: `018ff7c2-1f7c-7b28-b6c1-3f2e60b5${seedSuffix}`,
	specification: { ...specification, ...overrides },
});

const collectNodeIdsByKey = (value: JsonValue, ids = new Map<string, string>()): Map<string, string> => {
	if (Array.isArray(value)) {
		value.forEach((item) => collectNodeIdsByKey(item, ids));

		return ids;
	}

	const object = jsonObjectSchema.safeParse(value);

	if (!object.success) {
		return ids;
	}

	const node = z.object({ id: z.string(), key: z.string() }).safeParse(object.data);

	if (node.success) {
		ids.set(node.data.key, node.data.id);
	}

	Object.values(object.data).forEach((child) => collectNodeIdsByKey(child, ids));

	return ids;
};

describe("composed sections", () => {
	it("adds a section from the three layers and evaluates exact decimals", () => {
		const updated = editWebsiteSnapshot({ input: addSpecification(), snapshot: createSnapshot() });
		const section = updated.document.structure.pages[0]!.sections[0]!;
		const program = updated.document.logic?.[section.id];

		if (!program) {
			throw new Error("Expected an attached logic program");
		}

		expect(
			evaluateSiteBehavior({
				program,
				slots: Object.fromEntries(program.slots.map((slot) => [slot.key, slot.initial])),
			})
		).toBe("0.3");

		expect(section.source).toBeUndefined();

		expect(updated.document.content.ar?.sections[section.contentId]).toEqual(
			expect.objectContaining({ copy: expect.objectContaining({ heading: "تقدير فوري" }) })
		);
	});

	it("rejects legacy CEL whose executable IR diverges from its source", () => {
		const updated = editWebsiteSnapshot({ input: addSpecification(), snapshot: createSnapshot() });
		const section = updated.document.structure.pages[0]!.sections[0]!;
		const tampered = structuredClone(updated.document);
		const program = tampered.logic?.[section.id];

		if (program?.expressionProfile !== "site-expression-v1") {
			throw new Error("Expected a legacy expression program");
		}

		program.result = { type: "decimal", value: "999" };

		expect(validateSiteDocument(tampered)).toMatchObject({
			issues: [expect.objectContaining({ code: "behavior_source_mismatch" })],
			success: false,
		});
	});

	it("isolates preview logic to the selected section", () => {
		const updated = editWebsiteSnapshot({ input: addSpecification({}, "d336"), snapshot: createSnapshot() });
		const page = updated.document.structure.pages[0];
		const behaviorSection = page?.sections[0];
		const patternSection = page?.sections[1];

		if (!page || !behaviorSection || !patternSection) {
			throw new Error("Expected behavior and pattern sections");
		}

		const patternPreview = createWebsiteSectionPreviewDocument({
			document: updated.document,
			section: patternSection,
			target: { area: "page", index: 1, pageId: page.id, sectionId: patternSection.id },
		});

		expect(patternPreview.logic).toEqual({});

		const behaviorPreview = createWebsiteSectionPreviewDocument({
			document: updated.document,
			section: behaviorSection,
			target: { area: "page", index: 0, pageId: page.id, sectionId: behaviorSection.id },
		});

		expect(behaviorPreview.logic).toEqual({
			[behaviorSection.id]: updated.document.logic?.[behaviorSection.id],
		});
	});

	it("server-renders the exact initial result inside the localized section", () => {
		const updated = editWebsiteSnapshot({ input: addSpecification({}, "d336"), snapshot: createSnapshot() });

		const markup = renderToStaticMarkup(
			<SiteRenderer assets={updated.assets} brand={updated.brand} document={updated.document} locale='en' />
		);

		expect(markup).toContain("Instant estimate");
		expect(markup).toContain(">0.3<");
		expect(markup).toContain('inputMode="decimal"');
	});

	it("round-trips every layer through inspection", () => {
		const updated = editWebsiteSnapshot({ input: addSpecification({}, "d337"), snapshot: createSnapshot() });
		const section = updated.document.structure.pages[0]!.sections[0]!;
		const inspected = inspectComposedSection({ document: updated.document, section });

		expect(inspected).toEqual(composedSectionSpecificationSchema.parse(specification));
	});

	it("materializes, renders, and inspects server-bound media", () => {
		const assetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d398";

		const mediaSpecification = {
			content: {
				ar: { "beans-photo-alt": "كيس من حبوب البن المحمصة" },
				assets: { "beans-photo-asset": assetId },
				en: { "beans-photo-alt": "A bag of roasted coffee beans" },
			},
			logic: undefined,
			structure: {
				nodes: [
					{ children: ["frame"], key: "surface", props: { fill: "tint" }, type: "box" as const },
					{
						children: ["beans-photo"],
						key: "frame",
						props: { ...frameLayout, columns: 1 },
						type: "grid" as const,
					},
					{
						children: [],
						key: "beans-photo",
						props: {
							alt: "beans-photo-alt",
							aspectRatio: { height: 3, width: 4 },
							asset: "beans-photo-asset",
							fit: "cover" as const,
							radius: "theme" as const,
						},
						type: "media" as const,
					},
				],
				root: "surface",
			},
		};

		const updated = editWebsiteSnapshot({
			input: addSpecification(mediaSpecification, "d340"),
			snapshot: createSnapshot(),
		});

		const section = updated.document.structure.pages[0]!.sections[0]!;
		const inspected = inspectComposedSection({ document: updated.document, section });

		const markup = renderToStaticMarkup(
			<SiteRenderer
				assets={{ [assetId]: { src: "/beans.jpg" } }}
				brand={updated.brand}
				document={updated.document}
				locale='en'
			/>
		);

		expect(inspected).toEqual({ ...composedSectionSpecificationSchema.parse(mediaSpecification), logic: null });
		expect(markup).toContain('src="/beans.jpg"');
		expect(markup).toContain('alt="A bag of roasted coffee beans"');
	});

	it("keeps node identity across structure updates through stable keys", () => {
		const snapshot = createSnapshot();
		const pageId = snapshot.document.structure.pages[0]!.id;
		const added = editWebsiteSnapshot({ input: addSpecification({}, "d338"), snapshot });
		const section = added.document.structure.pages[0]!.sections[0]!;
		const initialIds = collectNodeIdsByKey(section.root);

		const restyled = createStructure(["base", "extra"]);
		restyled.nodes[0]!.props = { fill: "canvas" };

		const updated = editWebsiteSnapshot({
			input: { operation: "update-section", pageId, sectionId: section.id, structure: restyled },
			snapshot: added,
		});

		const updatedSection = updated.document.structure.pages[0]!.sections[0]!;
		const updatedIds = collectNodeIdsByKey(updatedSection.root);

		expect(updatedSection.id).toBe(section.id);
		expect(updatedSection.contentId).toBe(section.contentId);
		expect(updatedSection.root.type === "box" && updatedSection.root.props.fill).toBe("canvas");
		expect(Object.fromEntries(updatedIds)).toEqual(Object.fromEntries(initialIds));

		if (!updated.document.logic?.[updatedSection.id]) {
			throw new Error("Expected the logic layer to survive a structure update");
		}

		const renamed = createStructure(["base", "extra"]);
		renamed.nodes[3]! = { ...renamed.nodes[3]!, key: "headline" };
		renamed.nodes[2]!.children = ["headline", "description"];

		const renamedIds = collectNodeIdsByKey(
			editWebsiteSnapshot({
				input: { operation: "update-section", pageId, sectionId: section.id, structure: renamed },
				snapshot: updated,
			}).document.structure.pages[0]!.sections[0]!.root
		);

		expect(renamedIds.get("headline")).not.toBe(initialIds.get("heading"));
		expect(renamedIds.get("frame")).toBe(initialIds.get("frame"));
	});

	it("updates the content layer alone and validates its keys against the structure", () => {
		const snapshot = createSnapshot();
		const pageId = snapshot.document.structure.pages[0]!.id;
		const added = editWebsiteSnapshot({ input: addSpecification({}, "d339"), snapshot });
		const section = added.document.structure.pages[0]!.sections[0]!;

		const nextContent = structuredClone(specification.content);
		nextContent.en.heading = "Updated estimate";

		const updated = editWebsiteSnapshot({
			input: { content: nextContent, operation: "update-section", pageId, sectionId: section.id },
			snapshot: added,
		});

		const updatedSection = updated.document.structure.pages[0]!.sections[0]!;

		expect(updatedSection.root).toEqual(section.root);

		expect(updated.document.content.en?.sections[section.contentId]).toEqual(
			expect.objectContaining({ copy: expect.objectContaining({ heading: "Updated estimate" }) })
		);

		const orphaned = structuredClone(specification.content);
		Object.assign(orphaned.en, { stray: "Never referenced" });

		expect(() =>
			editWebsiteSnapshot({
				input: { content: orphaned, operation: "update-section", pageId, sectionId: section.id },
				snapshot: added,
			})
		).toThrow(WebsiteEditError);
	});

	it("swaps the logic layer alone while preserving section identity", () => {
		const snapshot = createSnapshot();
		const pageId = snapshot.document.structure.pages[0]!.id;
		const added = editWebsiteSnapshot({ input: addSpecification({}, "d33a"), snapshot });
		const section = added.document.structure.pages[0]!.sections[0]!;

		const updated = editWebsiteSnapshot({
			input: {
				logic: { ...expressionLogic, expression: "base * extra" },
				operation: "update-section",
				pageId,
				sectionId: section.id,
			},
			snapshot: added,
		});

		const updatedSection = updated.document.structure.pages[0]!.sections[0]!;

		expect(updatedSection.id).toBe(section.id);
		expect(updatedSection.root).toEqual(section.root);

		expect(inspectSectionLogic({ document: updated.document, section: updatedSection })).toEqual(
			expect.objectContaining({ expression: "base * extra", kind: "expression" })
		);
	});

	it("updates structure and replacement script logic atomically", async () => {
		const snapshot = createSnapshot();
		const pageId = snapshot.document.structure.pages[0]!.id;
		const added = editWebsiteSnapshot({ input: addSpecification({}, "d33d"), snapshot });
		const section = added.document.structure.pages[0]!.sections[0]!;
		const targetAnchor = added.document.structure.pages[0]!.sections[1]!.anchor;
		const baseStructure = createStructure(["base", "extra"]);

		const structure = sectionStructureSchema.parse({
			...baseStructure,
			nodes: [
				...baseStructure.nodes.map((node) =>
					node.key === "intro" ? { ...node, children: ["heading", "image-trigger"] } : node
				),
				{
					children: ["description"],
					key: "image-trigger",
					props: { event: "image_click", label: "image-trigger-label" },
					type: "trigger",
				},
			],
		});

		const content = createContent(["base", "extra"]);

		const logic: SectionLogic = {
			events: ["image_click"],
			fields: expressionLogic.fields,
			kind: "script",
			outputs: ["result"],
			script: `
function calculate(inputs) { return { result: Number(inputs.base) + Number(inputs.extra) }; }
function interact(event) {
				return event === "image_click" ? { type: "scroll-to", anchor: ${JSON.stringify(targetAnchor)} } : null;
}`.trim(),
		};

		const [prepared] = await prepareWebsiteEditInputs([
			{
				content: {
					ar: { ...content.ar, "image-trigger-label": "عرض التفاصيل" },
					en: { ...content.en, "image-trigger-label": "View details" },
				},
				logic,
				operation: "update-section",
				pageId,
				sectionId: section.id,
				structure,
			},
		]);

		if (!prepared) {
			throw new Error("Expected a prepared atomic update");
		}

		const updated = editWebsiteSnapshot({ input: prepared, snapshot: added });
		const updatedSection = updated.document.structure.pages[0]!.sections[0]!;

		expect(inspectSectionLogic({ document: updated.document, section: updatedSection })).toEqual(logic);
	});

	it("evaluates conditional expressions and bounded numeric functions", () => {
		const quantityLogic: SectionLogic = {
			expression: "quantity >= 2 ? quantity * 50 * 0.9 : quantity * 50",
			fields: [{ initial: "1", key: "quantity" }],
			kind: "expression",
		};

		const updated = editWebsiteSnapshot({
			input: addSpecification(
				{
					content: createContent(["quantity"]),
					logic: quantityLogic,
					structure: createStructure(["quantity"]),
				},
				"d33b"
			),
			snapshot: createSnapshot(),
		});

		const section = updated.document.structure.pages[0]!.sections[0]!;
		const program = updated.document.logic?.[section.id];

		if (!program) {
			throw new Error("Expected an attached logic program");
		}

		expect(evaluateSiteBehavior({ program, slots: { quantity: "1" } })).toBe("50");
		expect(evaluateSiteBehavior({ program, slots: { quantity: "2" } })).toBe("90");

		expect(
			sectionLogicSchema.safeParse({
				...quantityLogic,
				expression:
					"quantity > 0 && quantity <= 100 ? round(clamp(quantity, 0, 100) * 1.005, 2) : abs(quantity)",
			}).success
		).toBe(true);
	});

	it("exposes every label as an editable text node target", () => {
		const updated = editWebsiteSnapshot({ input: addSpecification({}, "d33c"), snapshot: createSnapshot() });
		const section = updated.document.structure.pages[0]!.sections[0]!;
		const pointers = listSectionTextNodeReferences({ node: section.root }).map((reference) => reference.pointer);

		expect(pointers).toEqual(
			expect.arrayContaining([
				"/copy/heading",
				"/copy/description",
				"/copy/base-label",
				"/copy/result-value-label",
			])
		);

		const editedPointers: Array<string> = [];

		const preview = renderToStaticMarkup(
			<SitePreviewRenderer
				brand={updated.brand}
				document={updated.document}
				sectionComponent={({ children }) => <>{children}</>}
				textElementProps={({ pointer }) => {
					editedPointers.push(pointer);

					return { "data-edit-pointer": pointer };
				}}
			/>
		);

		expect(editedPointers).toEqual(expect.arrayContaining(["/copy/result-value-label"]));
		expect(preview).toContain('data-edit-pointer="/copy/result-value-label"');
	});

	it("rejects layer contract violations with layer-scoped issues", () => {
		const missingContent = structuredClone(specification);
		delete missingContent.content.en["base-label"];

		const contentResult = composedSectionSpecificationSchema.safeParse(missingContent);
		expect(contentResult.success).toBe(false);
		expect(JSON.stringify(contentResult.error?.issues)).toContain("base-label");

		const strayLogic = structuredClone(specification);
		strayLogic.logic = { ...expressionLogic, fields: [...expressionLogic.fields, { initial: "1", key: "tax" }] };
		strayLogic.logic.expression = "base + extra + tax";
		expect(composedSectionSpecificationSchema.safeParse(strayLogic).success).toBe(false);

		const missingLogic = { ...structuredClone(specification), logic: undefined };
		expect(composedSectionSpecificationSchema.safeParse(missingLogic).success).toBe(false);

		expect(
			sectionLogicSchema.safeParse({ ...expressionLogic, expression: "base.map(value, value * 2)" }).success
		).toBe(false);

		expect(
			sectionLogicSchema.safeParse({
				expression: "10 / divisor",
				fields: [{ initial: "0", key: "divisor" }],
				kind: "expression",
			}).success
		).toBe(false);
	});

	it("accepts a static composed section without a logic layer", () => {
		const structure = {
			nodes: [
				{ children: ["frame"], key: "surface", props: { fill: "tint" }, type: "box" as const },
				{
					children: ["headline"],
					key: "frame",
					props: { ...frameLayout, direction: "column" },
					type: "flex" as const,
				},
				{
					children: [],
					key: "headline",
					props: { content: "headline", element: "h2" },
					type: "text" as const,
				},
			],
			root: "surface",
		};

		const updated = editWebsiteSnapshot({
			input: addSpecification(
				{
					content: { ar: { headline: "نص فقط" }, en: { headline: "Just copy" } },
					logic: undefined,
					structure,
				},
				"d33d"
			),
			snapshot: createSnapshot(),
		});

		const section = updated.document.structure.pages[0]!.sections[0]!;

		expect(updated.document.logic?.[section.id]).toBeUndefined();
		expect(section.source).toBeUndefined();
	});

	it("rejects compositions without outer gutters and vertical padding", () => {
		const flush = structuredClone(specification);
		const flushStructure = sectionStructureSchema.parse(flush.structure);
		delete flushStructure.nodes[1]?.props.padding;
		flush.structure = flushStructure;

		const result = composedSectionSpecificationSchema.safeParse(flush);

		expect(result.success).toBe(false);
		expect(JSON.stringify(result.error?.issues)).toContain("padding");
	});

	it.each(["0", "0px", "0rem", "0sp", 0])("rejects zero frame padding edge %j", (zero) => {
		const result = composedSectionSpecificationSchema.safeParse({
			content: { ar: {}, en: {} },
			structure: {
				nodes: [
					{
						children: [],
						key: "surface",
						props: { padding: { blockEnd: "4sp", blockStart: "4sp", inlineEnd: zero, inlineStart: "4sp" } },
						type: "box",
					},
				],
				root: "surface",
			},
		});

		expect(result.success).toBe(false);
		expect(JSON.stringify(result.error?.issues)).toContain("nonzero");
	});

	it("generates the authoring reference from the runtime schemas", () => {
		expect(sectionAuthoringReference).toContain("accent-text");
		expect(sectionAuthoringReference).toContain("display-2xl");
		expect(sectionAuthoringReference).toContain("silhouette-light");
		expect(sectionAuthoringReference).toContain("diagonal-slash");
		expect(sectionAuthoringReference).toContain("startStart");
		expect(sectionAuthoringReference).toContain('"6sp"');
		expect(sectionAuthoringReference).toContain("avoid medium");
		expect(sectionAuthoringReference).not.toContain("3rem");
	});

	it("rejects keys shared across text, asset, and link namespaces", () => {
		const result = composedSectionSpecificationSchema.safeParse({
			content: {
				ar: { shared: "صورة" },
				assets: { shared: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d399" },
				en: { shared: "Image" },
			},
			structure: {
				nodes: [
					{ children: ["image"], key: "surface", props: frameLayout, type: "box" },
					{ children: [], key: "image", props: { alt: "shared", asset: "shared" }, type: "media" },
				],
				root: "surface",
			},
		});

		expect(result.success).toBe(false);
		expect(JSON.stringify(result.error?.issues)).toContain("must be globally unique: shared");
	});

	it.each([
		["camel-case keys", { key: "camelCase", props: {}, type: "box" }],
		["missing children", { key: "copy", props: { content: "copy" }, type: "text" }],
		["scalar padding", { children: [], key: "surface", props: { padding: "1rem" }, type: "box" }],
		["legacy layout", { children: [], key: "surface", layout: { fill: "tint" }, props: {}, type: "box" }],
		[
			"CSS flex fields",
			{ children: [], key: "surface", props: { direction: "column", display: "flex" }, type: "flex" },
		],
		[
			"CSS grid fields",
			{
				children: [],
				key: "surface",
				props: { columns: 2, gridTemplateColumns: "1fr 1fr" },
				type: "grid",
			},
		],
		["unknown tones", { children: [], key: "copy", props: { content: "copy", tone: "secondary" }, type: "text" }],
	])("rejects provider-visible authoring mistakes: %s", (_label, node) => {
		expect(sectionStructureSchema.safeParse({ nodes: [node], root: node.key }).success).toBe(false);
	});

	it.each([
		["duplicate child", ["left", "left", "right"], []],
		["shared child", ["left", "right"], ["copy"]],
		["root as a child", ["left", "right"], ["surface"]],
	])("rejects non-tree topology: %s", (_label, rootChildren, rightChildren) => {
		const result = sectionStructureSchema.safeParse({
			nodes: [
				{ children: rootChildren, key: "surface", props: {}, type: "box" },
				{ children: ["copy"], key: "left", props: {}, type: "box" },
				{ children: rightChildren, key: "right", props: {}, type: "box" },
				{ children: [], key: "copy", props: { content: "copy" }, type: "text" },
			],
			root: "surface",
		});

		expect(result.success).toBe(false);
		expect(JSON.stringify(result.error?.issues)).toMatch(/cannot be a child|exactly one parent/u);
	});

	it.each([
		["field", { invalid: "amount-invalid", slot: "amount" }],
		["value", { format: resultFormat, output: "result", unavailable: "result-unavailable" }],
	])("requires a direct text label for %s nodes", (type, props) => {
		const result = sectionStructureSchema.safeParse({
			nodes: [
				{ children: ["control"], key: "surface", props: {}, type: "box" },
				{ children: ["not-a-label"], key: "control", props, type },
				{ children: [], key: "not-a-label", props: {}, type: "box" },
			],
			root: "surface",
		});

		expect(result.success).toBe(false);
		expect(JSON.stringify(result.error?.issues)).toContain("direct text-label child");
	});

	it("locks collection edits and layout swapping away from composed sections", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0]!;
		const updated = editWebsiteSnapshot({ input: addSpecification({}, "d33e"), snapshot });
		const composedSection = updated.document.structure.pages[0]!.sections[0]!;

		expect(() =>
			editWebsiteSnapshot({
				input: {
					collection: "/fields",
					itemId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d399",
					operation: "delete-collection-item",
					sectionId: composedSection.id,
				},
				snapshot: updated,
			})
		).toThrow(WebsiteEditError);

		expect(
			listWebsiteSectionLayouts({
				document: updated.document,
				target: { area: "page", index: 0, pageId: page.id, sectionId: composedSection.id },
			})
		).toEqual([]);
	});

	it("maps invalid insertion targets to WebsiteEditError", () => {
		const snapshot = createSnapshot();

		expect(() =>
			editWebsiteSnapshot({
				input: { ...addSpecification({}, "d33f"), index: 999 },
				snapshot,
			})
		).toThrow(WebsiteEditError);
	});
});

describe("section logic on pattern sections", () => {
	const bindingsFragment = {
		nodes: [
			{
				children: ["amount-field", "result-value"],
				key: "calculator",
				props: { direction: "column", gap: "1rem" },
				type: "flex" as const,
			},
			{
				children: ["amount-label"],
				key: "amount-field",
				props: { invalid: "amount-invalid", slot: "amount" },
				type: "field" as const,
			},
			{
				children: [],
				key: "amount-label",
				props: { content: "amount-label", element: "span" },
				type: "text" as const,
			},
			{
				children: ["result-label"],
				key: "result-value",
				props: { format: resultFormat, output: "result", unavailable: "result-unavailable" },
				type: "value" as const,
			},
			{
				children: [],
				key: "result-label",
				props: { content: "result-label", element: "span" },
				type: "text" as const,
			},
		],
		root: "calculator",
	};

	const bindingsContent = {
		ar: {
			"amount-invalid": "أدخل رقمًا",
			"amount-label": "المبلغ",
			"result-label": "الضعف",
			"result-unavailable": "غير متاح",
		},
		en: {
			"amount-invalid": "Enter a number",
			"amount-label": "Amount",
			"result-label": "Doubled",
			"result-unavailable": "Unavailable",
		},
	};

	const amountLogic: SectionLogic = {
		expression: "amount * 2",
		fields: [{ initial: "100", key: "amount" }],
		kind: "expression",
	};

	const attachToPatternSection = () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0]!;
		const target = page.sections[0]!;

		const updated = editWebsiteSnapshot({
			input: {
				bindings: {
					insert: [{ parentNodeId: target.root.id, structure: bindingsFragment }],
				},
				content: bindingsContent,
				logic: amountLogic,
				operation: "update-section",
				pageId: page.id,
				sectionId: target.id,
			},
			snapshot,
		});

		return { pageId: page.id, target, updated };
	};

	it("rejects logic bindings without a non-null logic layer in the same edit", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0]!;
		const target = page.sections[0]!;

		const input = {
			bindings: { remove: [target.root.id] },
			operation: "update-section" as const,
			pageId: page.id,
			sectionId: target.id,
		};

		expect(websiteEditInputSchema.safeParse(input)).toMatchObject({ success: false });
		expect(websiteEditInputSchema.safeParse({ ...input, bindings: {} })).toMatchObject({ success: false });
		expect(websiteEditInputSchema.safeParse({ ...input, logic: null })).toMatchObject({ success: false });
		expect(() => editWebsiteSnapshot({ input, snapshot })).toThrow(WebsiteEditError);
	});

	it("attaches logic and bindings to an existing pattern section in one edit", () => {
		const { target, updated } = attachToPatternSection();
		const section = updated.document.structure.pages[0]!.sections[0]!;

		expect(section.id).toBe(target.id);
		expect(section.source).toEqual(target.source);
		const program = updated.document.logic?.[section.id];

		if (!program) {
			throw new Error("Expected an attached logic program");
		}

		expect(evaluateSiteBehavior({ program, slots: { amount: "100" } })).toBe("200");
		expect(inspectSectionLogic({ document: updated.document, section })).toEqual(amountLogic);

		expect(updated.document.content.en?.sections[section.contentId]).toEqual(
			expect.objectContaining({ behavior: expect.objectContaining({ "amount-label": "Amount" }) })
		);

		const markup = renderToStaticMarkup(
			<SiteRenderer assets={updated.assets} brand={updated.brand} document={updated.document} locale='en' />
		);

		expect(markup).toContain(">200<");
		expect(markup).toContain("Amount");
	});

	it("rejects binding subtrees whose depth exceeds the parent context", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0]!;
		const target = page.sections[0]!;
		const count = siteDocumentResourceLimits.nodeDepth;

		const structure = {
			nodes: Array.from({ length: count }, (_, index) => ({
				children: index + 1 < count ? [`deep-${index + 1}`] : [],
				key: `deep-${index}`,
				props: index + 1 < count ? {} : { content: "amount-label" },
				type: index + 1 < count ? ("box" as const) : ("text" as const),
			})),
			root: "deep-0",
		};

		expect(() =>
			editWebsiteSnapshot({
				input: {
					bindings: { insert: [{ parentNodeId: target.root.id, structure }] },
					content: bindingsContent,
					logic: amountLogic,
					operation: "update-section",
					pageId: page.id,
					sectionId: target.id,
				},
				snapshot,
			})
		).toThrow(/node depth limit/u);
	});

	it("keeps update-text working on the attached copy and blocks layout swaps", () => {
		const { pageId, target, updated } = attachToPatternSection();

		const edited = editWebsiteSnapshot({
			input: {
				locale: "en",
				operation: "update-text",
				pageId,
				pointer: "/behavior/amount-label",
				sectionId: target.id,
				value: "Order amount",
			},
			snapshot: updated,
		});

		expect(edited.document.content.en?.sections[target.contentId]).toEqual(
			expect.objectContaining({ behavior: expect.objectContaining({ "amount-label": "Order amount" }) })
		);

		expect(() =>
			editWebsiteSnapshot({
				input: { operation: "swap-layout", pageId, pattern: "any-pattern", sectionId: target.id },
				snapshot: updated,
			})
		).toThrow(WebsiteEditError);
	});

	it("detaches logic, its binding nodes, and the reserved copy in one edit", () => {
		const { pageId, target, updated } = attachToPatternSection();

		const detached = editWebsiteSnapshot({
			input: { logic: null, operation: "update-section", pageId, sectionId: target.id },
			snapshot: updated,
		});

		const section = detached.document.structure.pages[0]!.sections[0]!;

		expect(detached.document.logic?.[section.id]).toBeUndefined();
		expect(JSON.stringify(section.root)).not.toContain('"field"');
		expect(detached.document.content.en?.sections[section.contentId]).not.toHaveProperty("behavior");
		expect(section.root).toEqual(target.root);
	});

	it("rejects logic without complete bindings and copy in the same edit", () => {
		const snapshot = createSnapshot();
		const page = snapshot.document.structure.pages[0]!;
		const target = page.sections[0]!;

		expect(() =>
			editWebsiteSnapshot({
				input: {
					logic: amountLogic,
					operation: "update-section",
					pageId: page.id,
					sectionId: target.id,
				},
				snapshot,
			})
		).toThrow(WebsiteEditError);
	});
});

describe("script logic", () => {
	const script =
		"function calculate(inputs) { let total = 0; for (let index = 1; index <= inputs.count; index += 1) { total += index; } return total; }";

	const scriptLogic: SectionLogic = {
		fields: [{ initial: "100", key: "count" }],
		kind: "script",
		outputs: ["result"],
		script,
	};

	it("evaluates iterative scripts inside the QuickJS sandbox", async () => {
		expect(await evaluateSiteScript({ inputs: { count: "100" }, script })).toEqual({ result: "5050" });
		expect(await evaluateSiteScript({ inputs: {}, script: "function calculate() { while (true) {} }" })).toBe(null);

		expect(await evaluateSiteScript({ inputs: {}, script: "function calculate() { return Math.random(); }" })).toBe(
			null
		);
	});

	it("resolves only declared interaction commands to exact anchors", async () => {
		const interactionScript = `${script}
function interact(event) {
	return event === "image_click" ? { type: "scroll-to", anchor: "more-than-a-coffee-stop" } : null;
}`;

		expect(
			await evaluateSiteScriptInteraction({
				event: "image_click",
				script: interactionScript,
			})
		).toEqual({ anchor: "more-than-a-coffee-stop", type: "scroll-to" });

		expect(
			await evaluateSiteScriptInteraction({
				event: "image_click",
				script: `${script}\nfunction interact() { return { type: "scroll-to", anchor: "#invalid" }; }`,
			})
		).toBe(null);
	});

	it("prepares script logic at the persistence boundary and rejects failing scripts", async () => {
		const snapshot = createSnapshot();

		const input = {
			index: 0,
			operation: "add-composed-section" as const,
			pageId: snapshot.document.structure.pages[0]!.id,
			seed: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d345",
			specification: {
				content: createContent(["count"]),
				logic: scriptLogic,
				structure: createStructure(["count"]),
			},
		};

		const [prepared] = await prepareWebsiteEditInputs([input]);

		if (prepared?.operation !== "add-composed-section") {
			throw new Error("Expected a prepared add edit");
		}

		if (prepared.specification.logic?.kind !== "script") {
			throw new Error("Expected prepared script logic");
		}

		expect(prepared.specification.logic.initialOutputs).toEqual({ result: "5050" });

		const updated = editWebsiteSnapshot({ input: prepared, snapshot });
		const section = updated.document.structure.pages[0]!.sections[0]!;
		const program = updated.document.logic?.[section.id];

		if (!program || program.expressionProfile !== "custom-js-v1") {
			throw new Error("Expected a custom script program");
		}

		expect(program.initialOutputs).toEqual({ result: "5050" });
		expect(inspectSectionLogic({ document: updated.document, section })).toEqual(scriptLogic);

		const markup = renderToStaticMarkup(
			<SiteRenderer assets={updated.assets} brand={updated.brand} document={updated.document} locale='en' />
		);

		expect(markup).toContain(">5,050<");

		await expect(
			prepareWebsiteEditInputs([
				{
					...input,
					specification: {
						...input.specification,
						logic: { ...scriptLogic, script: "function calculate() { while (true) {} }" },
					},
				},
			])
		).rejects.toThrow("failed");
	});

	it("persists declared trigger events only when their target anchor exists", async () => {
		const snapshot = createSnapshot();
		const targetAnchor = snapshot.document.structure.pages[0]!.sections[0]!.anchor;
		const baseStructure = createStructure(["count"]);

		const structure = sectionStructureSchema.parse({
			...baseStructure,
			nodes: [
				...baseStructure.nodes.map((node) =>
					node.key === "intro" ? { ...node, children: ["heading", "photo-trigger"] } : node
				),
				{
					children: ["description"],
					key: "photo-trigger",
					props: { event: "photo_click", label: "photo-trigger-label" },
					type: "trigger",
				},
			],
		});

		const content = createContent(["count"]);

		const logic: SectionLogic = {
			events: ["photo_click"],
			fields: [{ initial: "1", key: "count" }],
			kind: "script",
			outputs: ["result"],
			script: `
function calculate(inputs) { return inputs.count; }
function interact(event) {
	return event === "photo_click" ? { type: "scroll-to", anchor: ${JSON.stringify(targetAnchor)} } : null;
}`,
		};

		const input = {
			index: 0,
			operation: "add-composed-section" as const,
			pageId: snapshot.document.structure.pages[0]!.id,
			seed: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d346",
			specification: {
				content: {
					ar: { ...content.ar, "photo-trigger-label": "عرض التفاصيل" },
					en: { ...content.en, "photo-trigger-label": "View details" },
				},
				logic,
				structure,
			},
		};

		const [prepared] = await prepareWebsiteEditInputs([input]);

		if (!prepared) {
			throw new Error("Expected prepared interaction edit");
		}

		expect(() => editWebsiteSnapshot({ input: prepared, snapshot })).not.toThrow();

		const [missingTarget] = await prepareWebsiteEditInputs([
			{
				...input,
				seed: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d347",
				specification: {
					...input.specification,
					logic: {
						...logic,
						script: `
function calculate(inputs) { return inputs.count; }
function interact(event) {
	return event === "photo_click" ? { type: "scroll-to", anchor: "missing-section" } : null;
}`,
					},
				},
			},
		]);

		if (!missingTarget) {
			throw new Error("Expected prepared invalid-target edit");
		}

		expect(() => editWebsiteSnapshot({ input: missingTarget, snapshot })).toThrow(WebsiteEditError);
	});

	it("keeps the logic union variants strictly separate", () => {
		expect(sectionLogicSchema.safeParse({ ...expressionLogicWithScript() }).success).toBe(false);

		expect(sectionLogicSchema.safeParse({ fields: scriptLogic.fields, kind: "script", script }).success).toBe(
			false
		);

		expect(sectionLogicSchema.safeParse(scriptLogic).success).toBe(true);
	});

	it("keeps prepared script outputs out of the authoring schema", () => {
		const supplied = {
			...scriptLogic,
			initialOutputs: { result: "999" },
			script: 'function calculate() { throw new Error("boom"); }',
		};

		expect(sectionLogicSchema.safeParse(supplied).success).toBe(true);
		expect(sectionLogicAuthoringSchema.safeParse(scriptLogic).success).toBe(true);
		expect(sectionLogicAuthoringSchema.safeParse(supplied).success).toBe(false);
	});

	it("never trusts caller-supplied script outputs at the persistence boundary", async () => {
		const snapshot = createSnapshot();

		await expect(
			prepareWebsiteEditInputs([
				{
					index: 0,
					operation: "add-composed-section",
					pageId: snapshot.document.structure.pages[0]!.id,
					seed: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d346",
					specification: {
						content: createContent(["count"]),
						logic: {
							...scriptLogic,
							initialOutputs: { result: "999" },
							script: 'function calculate() { throw new Error("boom"); }',
						},
						structure: createStructure(["count"]),
					},
				},
			])
		).rejects.toThrow("failed");
	});
});

const expressionLogicWithScript = () => ({
	expression: "base",
	fields: [{ initial: "1", key: "base" }],
	kind: "expression" as const,
	script: "function calculate() { return 1; }",
});
