// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
	entityIdFromSeed,
	instantiateTemplate,
	parseSiteDocument,
	validateSiteDocument,
} from "@starter/infinite-website";
import {
	composedSectionSpecificationSchema,
	editWebsiteSnapshot,
	inspectSectionLogic,
	sectionLogicAuthoringSchema,
	type ComposedSectionSpecification,
} from "@starter/infinite-website/editing";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

import { compileBehaviorOutputs } from "../src/behavior/compile-expression";
import { siteBehaviorProgramSchema, type SiteBehaviorOutputType } from "../src/behavior/contracts";
import { evaluateSiteBehavior, evaluateSiteBehaviorOutputs } from "../src/behavior/expression-runtime";
import {
	BehaviorField,
	BehaviorRuntimeBoundary,
	BehaviorTrigger,
	BehaviorValue,
	BehaviorVisibility,
} from "../src/behavior/runtime";
import { testBrand } from "./fixtures/brand";

const fields = [{ initial: "0", key: "quantity" }];

const namedLogic = {
	events: { show_details: "details" },
	fields,
	kind: "expression" as const,
	outputs: {
		field_locked: { expression: "quantity <= 0", type: "boolean" as const },
		show: { expression: "quantity > 0", type: "boolean" as const },
		total: { expression: "quantity * 2", type: "decimal" as const },
		trigger_locked: { expression: "quantity <= 0", type: "boolean" as const },
	},
};

const framePadding = {
	blockEnd: "4rem",
	blockStart: "4rem",
	inlineEnd: "1.5rem",
	inlineStart: "1.5rem",
};

const createStructure = () => ({
	nodes: [
		{ children: ["frame"], key: "surface", props: { fill: "tint" as const }, type: "box" as const },
		{
			children: ["quantity-field", "conditional-copy", "total-value", "details-trigger"],
			key: "frame",
			props: { direction: "column" as const, gap: "1rem", padding: framePadding },
			type: "flex" as const,
		},
		{
			children: ["quantity-label"],
			key: "quantity-field",
			props: { disabledWhen: "field_locked", slot: "quantity" },
			type: "field" as const,
		},
		{
			children: [],
			key: "quantity-label",
			props: { content: "quantity-label", element: "span" as const },
			type: "text" as const,
		},
		{
			children: [],
			key: "conditional-copy",
			props: { content: "conditional-copy", element: "p" as const, visibleWhen: "show" },
			type: "text" as const,
		},
		{
			children: ["total-label"],
			key: "total-value",
			props: {
				format: { maximumFractionDigits: 0, style: "decimal" as const },
				output: "total",
				unavailable: "total-unavailable",
			},
			type: "value" as const,
		},
		{
			children: [],
			key: "total-label",
			props: { content: "total-label", element: "span" as const },
			type: "text" as const,
		},
		{
			children: ["trigger-label"],
			key: "details-trigger",
			props: {
				disabledWhen: "trigger_locked",
				event: "show_details",
				label: "trigger-label",
			},
			type: "trigger" as const,
		},
		{
			children: [],
			key: "trigger-label",
			props: { content: "trigger-label", element: "span" as const },
			type: "text" as const,
		},
	],
	root: "surface",
});

const content = {
	ar: {
		"conditional-copy": "التفاصيل متاحة",
		"quantity-label": "الكمية",
		"total-label": "الإجمالي",
		"total-unavailable": "غير متاح",
		"trigger-label": "عرض التفاصيل",
	},
	en: {
		"conditional-copy": "Details are available",
		"quantity-label": "Quantity",
		"total-label": "Total",
		"total-unavailable": "Unavailable",
		"trigger-label": "Show details",
	},
};

const createSpecification = () => ({ content, logic: namedLogic, structure: createStructure() });

const replaceOutput = (
	key: keyof typeof namedLogic.outputs,
	output: { expression: string; type: SiteBehaviorOutputType }
) => {
	const specification = createSpecification();

	return {
		...specification,
		logic: {
			...specification.logic,
			outputs: { ...specification.logic.outputs, [key]: output },
		},
	};
};

const createSnapshot = () => ({
	assets: {},
	brand: testBrand,
	document: instantiateTemplate({
		content: nordicEdgeContent,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `typed-behavior:${kind}:${path}` }),
		definition: nordicEdgeTemplate,
		path: "/typed-behavior",
	}),
	schemaVersion: 1 as const,
	templateId: "nordic-edge",
});

const addSpecification = (specification?: ReturnType<typeof createSpecification>) => {
	const snapshot = createSnapshot();
	const targetAnchor = snapshot.document.structure.pages[0]!.sections.at(-1)!.anchor;

	const resolvedSpecification =
		specification ??
		({
			...createSpecification(),
			logic: { ...namedLogic, events: { show_details: targetAnchor } },
		} satisfies ReturnType<typeof createSpecification>);

	return {
		input: {
			index: 0,
			operation: "add-composed-section" as const,
			pageId: snapshot.document.structure.pages[0]!.id,
			seed: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5e001",
			specification: resolvedSpecification,
		},
		snapshot,
	};
};

const issues = (specification: ComposedSectionSpecification) => {
	const result = composedSectionSpecificationSchema.safeParse(specification);

	return result.success ? "" : result.error.issues.map((issue) => issue.message).join("\n");
};

describe("typed CEL contracts", () => {
	it("keeps persisted site-expression-v1 programs compatible", () => {
		const persisted = siteBehaviorProgramSchema.parse({
			behaviorVersion: 1,
			expressionProfile: "site-expression-v1",
			result: {
				lhs: { key: "quantity", type: "reference" },
				operator: "*",
				rhs: { type: "decimal", value: "2" },
				type: "binary",
			},
			slots: fields,
			source: "quantity * 2",
		});

		expect(evaluateSiteBehavior({ program: persisted, slots: { quantity: "3" } })).toBe("6");
		expect(evaluateSiteBehaviorOutputs({ program: persisted, slots: { quantity: "3" } })).toEqual({
			result: "6",
		});
	});

	it("compiles, admits, and evaluates multiple named decimal and boolean outputs", () => {
		const program = compileBehaviorOutputs({
			events: { show_details: "details" },
			fields,
			outputs: {
				show: { source: "quantity > 0", type: "boolean" },
				total: { source: "quantity * 2", type: "decimal" },
			},
		});

		expect(siteBehaviorProgramSchema.parse(program)).toEqual(program);
		expect(program).toMatchObject({
			events: { show_details: "details" },
			expressionProfile: "site-expression-v2",
			outputs: {
				show: { source: "quantity > 0", type: "boolean" },
				total: { source: "quantity * 2", type: "decimal" },
			},
		});
		expect(evaluateSiteBehaviorOutputs({ program, slots: { quantity: "3" } })).toEqual({
			show: true,
			total: "6",
		});
		expect(() =>
			compileBehaviorOutputs({
				fields,
				outputs: { invalid: { source: "quantity * 2", type: "boolean" } },
			})
		).toThrow(/declares boolean but its expression produces decimal/u);
	});

	it("isolates named output failures and rejects invalid initial values", () => {
		const program = compileBehaviorOutputs({
			fields: [{ initial: "1", key: "quantity" }],
			outputs: {
				broken: { source: "1 / (quantity - 1)", type: "decimal" },
				show: { source: "quantity > 0", type: "boolean" },
			},
		});

		expect(evaluateSiteBehaviorOutputs({ program, slots: { quantity: "1" } })).toEqual({ show: true });
		expect(
			sectionLogicAuthoringSchema.safeParse({
				fields,
				kind: "expression",
				outputs: {
					broken: { expression: "quantity / quantity", type: "decimal" },
					show: { expression: "quantity >= 0", type: "boolean" },
				},
			}).success
		).toBe(false);
	});

	it("rejects event targets on a different page", () => {
		const snapshot = structuredClone(createSnapshot());
		const sourcePage = snapshot.document.structure.pages[0];
		const targetSection = sourcePage?.sections.pop();
		const targetPageId = entityIdFromSeed({ seed: "typed-behavior:target-page" });

		if (!sourcePage || !targetSection) {
			throw new Error("Typed behavior fixture needs a target section");
		}

		snapshot.document.structure.pages.push({ home: false, id: targetPageId, sections: [targetSection] });
		snapshot.document.locales.forEach((locale) => {
			const localized = snapshot.document.content[locale];
			const sourcePageContent = localized?.pages[sourcePage.id];

			if (!localized || !sourcePageContent) {
				throw new Error(`Typed behavior fixture is missing ${locale} page content`);
			}

			localized.pages[targetPageId] = {
				...sourcePageContent,
				route: { slug: `${sourcePageContent.route.slug}-details` },
			};
		});

		const specification = {
			...createSpecification(),
			logic: { ...namedLogic, events: { show_details: targetSection.anchor } },
		};

		const input = {
			index: 0,
			operation: "add-composed-section" as const,
			pageId: sourcePage.id,
			seed: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5e002",
			specification,
		};

		expect(() => editWebsiteSnapshot({ input, snapshot })).toThrow("invalid_behavior_target");
	});

	it("rejects named CEL whose executable IR diverges from its source", () => {
		const { input, snapshot } = addSpecification();
		const updated = editWebsiteSnapshot({ input, snapshot });
		const section = updated.document.structure.pages[0]!.sections[0]!;
		const tampered = structuredClone(updated.document);
		const program = tampered.logic?.[section.id];

		if (program?.expressionProfile !== "site-expression-v2") {
			throw new Error("Expected a named expression program");
		}

		program.outputs.total!.result = { type: "decimal", value: "999" };

		expect(validateSiteDocument(tampered)).toMatchObject({
			issues: [expect.objectContaining({ code: "behavior_source_mismatch" })],
			success: false,
		});
	});

	it("accepts the named authoring shape and rejects binding type mismatches", () => {
		expect(sectionLogicAuthoringSchema.parse(namedLogic)).toEqual(namedLogic);
		expect(composedSectionSpecificationSchema.safeParse(createSpecification())).toMatchObject({ success: true });

		const valueMismatch = replaceOutput("total", { expression: "quantity > 0", type: "boolean" });
		expect(issues(valueMismatch)).toContain('Output "total" is boolean but its structure binding requires decimal');

		const visibilityMismatch = replaceOutput("show", { expression: "quantity * 2", type: "decimal" });
		expect(issues(visibilityMismatch)).toContain(
			'Output "show" is decimal but its structure binding requires boolean'
		);

		const fieldDisabledMismatch = replaceOutput("field_locked", { expression: "quantity", type: "decimal" });
		expect(issues(fieldDisabledMismatch)).toContain(
			'Output "field_locked" is decimal but its structure binding requires boolean'
		);

		const triggerDisabledMismatch = replaceOutput("trigger_locked", {
			expression: "quantity",
			type: "decimal",
		});

		expect(issues(triggerDisabledMismatch)).toContain(
			'Output "trigger_locked" is decimal but its structure binding requires boolean'
		);
	});

	it("does not let custom JavaScript outputs bind boolean visibility or disabled props", () => {
		const specification: ComposedSectionSpecification = {
			...createSpecification(),
			logic: {
				events: ["show_details"],
				fields,
				initialOutputs: { field_locked: "1", show: "1", total: "0", trigger_locked: "1" },
				kind: "script",
				outputs: ["field_locked", "show", "total", "trigger_locked"],
				script: "function calculate(inputs) { return { field_locked: inputs.quantity, show: inputs.quantity, total: inputs.quantity, trigger_locked: inputs.quantity }; }\nfunction interact() { return { type: 'scroll-to', anchor: 'details' }; }",
				targets: { show_details: "details" },
			},
		};

		expect(issues(specification)).toContain("structure binding requires boolean");
	});
});

describe("typed CEL runtime", () => {
	it("fails closed per missing visibility and disabled output while preserving valid siblings", () => {
		const program = compileBehaviorOutputs({
			fields: [{ initial: "1", key: "quantity" }],
			outputs: {
				broken_disabled: { source: "1 / (quantity - 1) < 0", type: "boolean" },
				broken_visible: { source: "1 / (quantity - 1) > 0", type: "boolean" },
				show: { source: "quantity > 0", type: "boolean" },
			},
		});

		const { unmount } = render(
			<BehaviorRuntimeBoundary program={program}>
				<BehaviorVisibility output='show'>Valid sibling</BehaviorVisibility>
				<BehaviorVisibility output='broken_visible'>Unsafe sibling</BehaviorVisibility>
				<BehaviorField disabledWhen='broken_disabled' slot='quantity'>
					Guarded quantity
				</BehaviorField>
			</BehaviorRuntimeBoundary>
		);

		expect(screen.getByText("Valid sibling")).toBeTruthy();
		expect(screen.queryByText("Unsafe sibling")).toBeNull();
		expect(screen.getByRole("textbox", { name: "Guarded quantity" })).toHaveProperty("disabled", true);
		unmount();
	});

	it("updates named values, visibility, field state, and trigger state without JavaScript", () => {
		const scrollIntoView = vi.fn();

		const program = compileBehaviorOutputs({
			events: { show_details: "details" },
			fields,
			outputs: {
				field_locked: { source: "quantity <= 0", type: "boolean" },
				show: { source: "quantity > 0", type: "boolean" },
				total: { source: "quantity * 2", type: "decimal" },
				trigger_locked: { source: "quantity <= 0", type: "boolean" },
			},
		});

		render(
			<>
				<BehaviorRuntimeBoundary program={program}>
					<BehaviorField slot='quantity'>Quantity</BehaviorField>
					<BehaviorField disabledWhen='field_locked' slot='quantity'>
						Guarded quantity
					</BehaviorField>
					<BehaviorVisibility output='show'>Details are available</BehaviorVisibility>
					<BehaviorValue
						format={{ maximumFractionDigits: 0, style: "decimal" }}
						locale='en'
						unavailable='Unavailable'
						value='total'
					>
						Total
					</BehaviorValue>
					<BehaviorTrigger disabledWhen='trigger_locked' event='show_details' label='Show details'>
						Show details
					</BehaviorTrigger>
				</BehaviorRuntimeBoundary>
				<div data-website-anchor='details' ref={(node) => Object.assign(node ?? {}, { scrollIntoView })}>
					Details target
				</div>
			</>
		);

		const guarded = screen.getByRole("textbox", { name: "Guarded quantity" });
		const trigger = screen.getByRole("button", { name: "Show details" });
		expect(guarded).toHaveProperty("disabled", true);
		expect(trigger.getAttribute("aria-disabled")).toBe("true");
		expect(trigger.getAttribute("tabindex")).toBe("0");
		expect(screen.queryByText("Details are available")).toBeNull();

		fireEvent.click(trigger);
		expect(scrollIntoView).not.toHaveBeenCalled();

		fireEvent.change(screen.getByRole("textbox", { name: "Quantity" }), { target: { value: "2" } });

		expect(screen.getByText("Details are available")).toBeTruthy();
		expect(screen.getByText("4")).toBeTruthy();
		expect(guarded).toHaveProperty("disabled", false);
		expect(trigger.getAttribute("aria-disabled")).toBeNull();
		expect(trigger.getAttribute("tabindex")).toBe("0");

		fireEvent.click(trigger);
		expect(scrollIntoView).toHaveBeenCalledOnce();
	});
});

describe("typed CEL editing", () => {
	it("round-trips named logic and removes every behavior binding as one valid edit", () => {
		const { input, snapshot } = addSpecification();
		const added = editWebsiteSnapshot({ input, snapshot });
		const page = added.document.structure.pages[0]!;
		const section = page.sections[0]!;

		expect(inspectSectionLogic({ document: added.document, section })).toEqual(input.specification.logic);

		const detached = editWebsiteSnapshot({
			input: { logic: null, operation: "update-section", pageId: page.id, sectionId: section.id },
			snapshot: added,
		});

		const detachedSection = detached.document.structure.pages[0]!.sections[0]!;
		const serialized = JSON.stringify(detachedSection.root);

		expect(detached.document.logic?.[section.id]).toBeUndefined();
		expect(serialized).not.toMatch(/disabledWhen|visibleWhen|"field"|"trigger"|"value"/u);
		expect(parseSiteDocument(detached.document)).toEqual(detached.document);
	});
});
