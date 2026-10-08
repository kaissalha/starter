import { describe, expect, it, vi } from "vitest";

import { siteBehaviorProgramSchema } from "../src/behavior/contracts";
import { sectionLogicBindingsSchema } from "../src/behavior/edit";
import {
	prepareSectionLogic,
	sectionLogicAuthoringSchema,
	sectionStructureSchema,
} from "../src/behavior/specification";
import type { JsonValue } from "../src/document/content-schema";
import { validateSiteDocument } from "../src/document/document-validation";
import { siteNodeSchema } from "../src/document/structure-schema";
import { sectionAuthoringResourceLimits, siteDocumentResourceLimits } from "../src/resource-limits";
import { entityIdFromSeed } from "../src/sections/entity-id";
import { nordicEdgeTemplate } from "../src/templates/nordic-edge";
import nordicEdgeContent from "../src/templates/nordic-edge/content.json";
import { instantiateTemplate } from "../src/templates/template-definition";

const issueCodes = (input: JsonValue) => {
	const result = validateSiteDocument(input);

	return result.success ? [] : result.issues.map(({ code }) => code);
};

const createDocument = () =>
	instantiateTemplate({
		content: nordicEdgeContent,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `runtime-hardening:${kind}:${path}` }),
		definition: nordicEdgeTemplate,
		path: "/runtime-hardening",
	});

const textNode = (seed: string) =>
	siteNodeSchema.parse({
		id: entityIdFromSeed({ seed }),
		props: { content: { $text: "/copy/heading" } },
		type: "text",
	});

describe("site document resource budgets", () => {
	it("aligns flat authoring depth with the persisted section limit", () => {
		const structure = (count: number) => ({
			nodes: Array.from({ length: count }, (_, index) => ({
				children: index + 1 < count ? [`node-${index + 1}`] : [],
				key: `node-${index}`,
				props: index + 1 < count ? {} : { content: "leaf" },
				type: index + 1 < count ? ("box" as const) : ("text" as const),
			})),
			root: "node-0",
		});

		expect(sectionStructureSchema.safeParse(structure(siteDocumentResourceLimits.nodeDepth)).success).toBe(true);
		const tooDeep = sectionStructureSchema.safeParse(structure(siteDocumentResourceLimits.nodeDepth + 1));
		expect(tooDeep.success).toBe(false);
		expect(tooDeep.error?.issues.map(({ message }) => message).join("\n")).toContain("node depth exceeds");
	});

	it("rejects repeated-edge authoring graphs without expanding every path", () => {
		const count = siteDocumentResourceLimits.nodeDepth;

		const structure = {
			nodes: Array.from({ length: count }, (_, index) => ({
				children: index + 1 < count ? [`node-${index + 1}`, `node-${index + 1}`] : [],
				key: `node-${index}`,
				props: index + 1 < count ? {} : { content: "leaf" },
				type: index + 1 < count ? ("box" as const) : ("text" as const),
			})),
			root: "node-0",
		};

		expect(() => sectionStructureSchema.safeParse(structure)).not.toThrow();
		expect(sectionStructureSchema.safeParse(structure).success).toBe(false);
	});

	it("bounds aggregate nodes across logic-binding insertions", () => {
		const structure = (prefix: string) => ({
			nodes: [
				{
					children: [`${prefix}-group-a`, `${prefix}-group-b`],
					key: `${prefix}-root`,
					props: {},
					type: "box" as const,
				},
				...(["a", "b"] as const).map((group, groupIndex) => ({
					children: Array.from({ length: 63 }, (_, index) => `${prefix}-leaf-${groupIndex * 63 + index}`),
					key: `${prefix}-group-${group}`,
					props: {},
					type: "box" as const,
				})),
				...Array.from({ length: 126 }, (_, index) => ({
					children: [],
					key: `${prefix}-leaf-${index}`,
					props: { content: `${prefix}-copy-${index}` },
					type: "text" as const,
				})),
			],
			root: `${prefix}-root`,
		});

		expect(
			sectionLogicBindingsSchema.safeParse({
				insert: [
					{ parentNodeId: entityIdFromSeed({ seed: "binding-parent-1" }), structure: structure("one") },
					{ parentNodeId: entityIdFromSeed({ seed: "binding-parent-2" }), structure: structure("two") },
				],
			}).success
		).toBe(false);
	});

	it.each([
		{
			code: "too_many_locales",
			input: { locales: Array.from({ length: siteDocumentResourceLimits.locales + 1 }, () => "en") },
		},
		{
			code: "too_many_pages",
			input: { structure: { pages: Array.from({ length: siteDocumentResourceLimits.pages + 1 }, () => ({})) } },
		},
		{
			code: "too_many_sections",
			input: {
				structure: {
					pages: [
						{
							sections: Array.from({ length: siteDocumentResourceLimits.sections + 1 }, () => ({})),
						},
					],
				},
			},
		},
	])("rejects $code before document parsing", ({ code, input }) => {
		expect(issueCodes(input)).toContain(code);
	});

	it("rejects section depth, per-section nodes, aggregate nodes, and document bytes", () => {
		const deepRoot = Array.from({ length: siteDocumentResourceLimits.nodeDepth }).reduce<JsonValue>(
			(root) => ({ props: { children: [root] }, type: "box" }),
			{ type: "text" }
		);

		expect(issueCodes({ structure: { pages: [{ sections: [{ root: deepRoot }] }] } })).toContain(
			"section_too_deep"
		);

		const oversizedSection = {
			root: {
				props: {
					children: Array.from({ length: siteDocumentResourceLimits.sectionNodes }, () => ({ type: "text" })),
				},
				type: "box",
			},
		};

		expect(issueCodes({ structure: { pages: [{ sections: [oversizedSection] }] } })).toContain(
			"section_has_too_many_nodes"
		);

		const maximumSection = {
			root: {
				props: {
					children: Array.from({ length: siteDocumentResourceLimits.sectionNodes - 1 }, () => ({
						type: "text",
					})),
				},
				type: "box",
			},
		};

		const sectionsForAggregateOverflow = Array.from(
			{ length: Math.floor(siteDocumentResourceLimits.nodes / siteDocumentResourceLimits.sectionNodes) + 1 },
			() => structuredClone(maximumSection)
		);

		expect(issueCodes({ structure: { pages: [{ sections: sectionsForAggregateOverflow }] } })).toContain(
			"document_has_too_many_nodes"
		);

		expect(issueCodes({ content: "x".repeat(siteDocumentResourceLimits.bytes + 1) })).toContain(
			"document_too_large"
		);
	});

	it("rejects deeply nested non-structure JSON before recursive schema parsing", () => {
		const nested = Array.from({ length: siteDocumentResourceLimits.jsonDepth + 1 }).reduce<JsonValue>(
			(value) => [value],
			"leaf"
		);

		expect(issueCodes(nested)).toContain("document_json_too_deep");
	});

	it("caps aggregate custom-script runtimes across the document", () => {
		const logic = Object.fromEntries(
			Array.from({ length: siteDocumentResourceLimits.customScriptPrograms + 1 }, (_, index) => [
				`section-${index}`,
				{ expressionProfile: "custom-js-v1" },
			])
		);

		expect(issueCodes({ logic })).toContain("too_many_custom_script_programs");
	});
});

describe("behavior hardening", () => {
	it("caps authoring and persisted behavior declarations", () => {
		const fields = Array.from({ length: sectionAuthoringResourceLimits.fields + 1 }, (_, index) => ({
			initial: "1",
			key: `field_${index}`,
		}));

		expect(
			sectionLogicAuthoringSchema.safeParse({
				fields,
				kind: "script",
				outputs: ["result"],
				script: "function calculate() { return 1; }",
			}).success
		).toBe(false);

		expect(
			siteBehaviorProgramSchema.safeParse({
				behaviorVersion: 1,
				expressionProfile: "custom-js-v1",
				initialOutputs: { result: "1" },
				outputs: ["result"],
				script: "function calculate() { return 1; }",
				slots: fields,
			}).success
		).toBe(false);

		const field = [{ initial: "1", key: "amount" }];

		const outputs = Array.from(
			{ length: sectionAuthoringResourceLimits.outputs + 1 },
			(_, index) => `output_${index}`
		);

		const events = Array.from(
			{ length: sectionAuthoringResourceLimits.events + 1 },
			(_, index) => `event_${index}`
		);

		expect(
			sectionLogicAuthoringSchema.safeParse({
				fields: field,
				kind: "script",
				outputs,
				script: "function calculate() { return 1; }",
			}).success
		).toBe(false);

		expect(
			sectionLogicAuthoringSchema.safeParse({
				events,
				fields: field,
				kind: "script",
				outputs: ["result"],
				script: "function calculate() { return 1; }",
			}).success
		).toBe(false);
	});

	it("requires one text label and rejects interactive descendants inside triggers", () => {
		const invalidLabel = sectionStructureSchema.safeParse({
			nodes: [
				{ children: ["field"], key: "root", props: {}, type: "box" },
				{ children: ["label-one", "label-two"], key: "field", props: { slot: "amount" }, type: "field" },
				{ children: [], key: "label-one", props: { content: "label-one" }, type: "text" },
				{ children: [], key: "label-two", props: { content: "label-two" }, type: "text" },
			],
			root: "root",
		});

		expect(invalidLabel.success).toBe(false);

		const invalidValueLabel = sectionStructureSchema.safeParse({
			nodes: [
				{ children: ["value"], key: "root", props: {}, type: "box" },
				{
					children: ["label-one", "label-two"],
					key: "value",
					props: {
						format: { style: "decimal" },
						output: "result",
						unavailable: "unavailable",
					},
					type: "value",
				},
				{ children: [], key: "label-one", props: { content: "label-one" }, type: "text" },
				{ children: [], key: "label-two", props: { content: "label-two" }, type: "text" },
			],
			root: "root",
		});

		expect(invalidValueLabel.success).toBe(false);

		const conditionalFieldLabel = sectionStructureSchema.safeParse({
			nodes: [
				{ children: ["field"], key: "root", props: {}, type: "box" },
				{ children: ["field-label"], key: "field", props: { slot: "amount" }, type: "field" },
				{
					children: [],
					key: "field-label",
					props: { content: "field-label", visibleWhen: "show" },
					type: "text",
				},
			],
			root: "root",
		});

		expect(conditionalFieldLabel.success).toBe(false);

		const nestedInteractive = sectionStructureSchema.safeParse({
			nodes: [
				{ children: ["trigger"], key: "root", props: {}, type: "box" },
				{
					children: ["field"],
					key: "trigger",
					props: { event: "open", label: "trigger-label" },
					type: "trigger",
				},
				{ children: ["field-label"], key: "field", props: { slot: "amount" }, type: "field" },
				{ children: [], key: "field-label", props: { content: "field-label" }, type: "text" },
			],
			root: "root",
		});

		expect(nestedInteractive.success).toBe(false);
	});

	it("enforces behavior markup semantics on canonical persisted documents", () => {
		const document = createDocument();
		const section = document.structure.pages[0]?.sections[0];

		if (!section) {
			throw new Error("Expected a template section");
		}

		section.root = siteNodeSchema.parse({
			id: entityIdFromSeed({ seed: "semantic-root" }),
			props: {
				children: [
					{
						id: entityIdFromSeed({ seed: "semantic-trigger" }),
						props: {
							children: [
								{
									id: entityIdFromSeed({ seed: "semantic-field" }),
									props: { children: [textNode("semantic-label")], slot: "amount" },
									type: "field",
								},
							],
							event: "open",
							label: { $text: "/copy/heading" },
						},
						type: "trigger",
					},
				],
			},
			type: "box",
		});

		const result = validateSiteDocument(document);

		expect(result.success ? [] : result.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "invalid_interactive_containment" })])
		);
	});

	it("rejects persisted accessible names removed at a responsive breakpoint", () => {
		const document = createDocument();
		const section = document.structure.pages[0]?.sections[0];

		if (!section) {
			throw new Error("Expected a template section");
		}

		section.root = siteNodeSchema.parse({
			id: entityIdFromSeed({ seed: "responsive-label-root" }),
			props: {
				children: [
					{
						id: entityIdFromSeed({ seed: "responsive-label-action" }),
						props: {
							children: [
								{
									id: entityIdFromSeed({ seed: "responsive-label-copy" }),
									layout: { visibility: { base: "visible", compact: "removed" } },
									props: { content: { $text: "/copy/heading" } },
									type: "text",
								},
							],
							href: { $link: "/actions/primary" },
						},
						type: "action",
					},
				],
			},
			type: "box",
		});

		const result = validateSiteDocument(document);

		expect(result.success ? [] : result.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: "invalid_action_label" })])
		);
	});

	it("uses one QuickJS session for initial calculation and every declared event", async ({ onTestFinished }) => {
		const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now());
		onTestFinished(() => clock.mockRestore());

		const prepared = await prepareSectionLogic({
			events: ["first_event", "second_event"],
			fields: [{ initial: "1", key: "amount" }],
			kind: "script",
			outputs: ["result"],
			script: `let calls = 0;
function calculate(inputs) { calls += 1; return { result: inputs.amount }; }
function interact(event) {
	calls += 1;
	if (event === "first_event" && calls === 2) return { type: "scroll-to", anchor: "first-target" };
	if (event === "second_event" && calls === 3) return { type: "scroll-to", anchor: "second-target" };
	return null;
}`,
		});

		expect(prepared).toMatchObject({
			initialOutputs: { result: "1" },
			targets: { first_event: "first-target", second_event: "second-target" },
		});
	});
});
