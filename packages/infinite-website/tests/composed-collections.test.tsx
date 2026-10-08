import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { SiteRenderer, entityIdFromSeed, instantiateTemplate } from "@starter/infinite-website";
import {
	composedSectionSpecificationSchema,
	editWebsiteSnapshot,
	inspectComposedSection,
	sectionStructureSchema,
} from "@starter/infinite-website/editing";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

import type { SectionStructureNode } from "../src/behavior/specification";
import { listSectionTextNodeReferences } from "../src/document/section-content-references";
import { testBrand } from "./fixtures/brand";

const frame = {
	direction: "column",
	gap: "6sp",
	padding: {
		blockEnd: "12sp",
		blockStart: "12sp",
		inlineEnd: "6sp",
		inlineStart: "6sp",
	},
};

const text = (key: string, element = "p") => ({
	children: [],
	key,
	props: { content: key, element },
	type: "text" as const,
});

const item = (key: string, trigger: string, panel: string) => ({
	children: [trigger, panel],
	key,
	props: {},
	type: "item" as const,
});

const copy = {
	"car-label": ["Highlights", "أبرز المزايا"],
	"car-next": ["Next slide", "الشريحة التالية"],
	"car-previous": ["Previous slide", "الشريحة السابقة"],
	"dots-label": ["Choose slide", "اختر الشريحة"],
	"faq-a1": ["We reply within a day.", "نرد خلال يوم."],
	"faq-a2": ["Yes, on request.", "نعم عند الطلب."],
	"faq-q1": ["How fast do you reply?", "ما سرعة ردكم؟"],
	"faq-q2": ["Do you travel?", "هل تسافرون؟"],
	"form-another": ["Send another", "إرسال رسالة أخرى"],
	"form-email": ["Email", "البريد الإلكتروني"],
	"form-error": ["Something went wrong", "حدث خطأ ما"],
	"form-label": ["Contact form", "نموذج التواصل"],
	"form-message": ["Message", "الرسالة"],
	"form-name": ["Name", "الاسم"],
	"form-pending": ["Sending", "جارٍ الإرسال"],
	"form-submit": ["Send", "إرسال"],
	"form-success": ["Thanks", "شكرًا لك"],
	heading: ["Studio", "الاستوديو"],
	"map-address": ["12 Market Street, London", "12 شارع السوق، لندن"],
	"map-label": ["Studio location", "موقع الاستوديو"],
	"slide-one": ["First slide", "الشريحة الأولى"],
	"slide-two": ["Second slide", "الشريحة الثانية"],
	"tab-one": ["Design", "التصميم"],
	"tab-one-panel": ["We design.", "نصمم."],
	"tab-two": ["Build", "البناء"],
	"tab-two-panel": ["We build.", "نبني."],
	"tabs-label": ["Services", "الخدمات"],
} as const;

const content = (overrides: Partial<Record<keyof typeof copy, [string, string]>> = {}) => {
	const merged = { ...copy, ...overrides };
	const entries = Object.entries(merged);

	return {
		ar: Object.fromEntries(entries.map(([key, [, ar]]) => [key, ar])),
		en: Object.fromEntries(entries.map(([key, [en]]) => [key, en])),
	};
};

const structureNodes = (): Array<SectionStructureNode> => [
	{
		children: ["frame"],
		key: "surface",
		props: { fill: "tint", reveal: { animation: "rise", delayMs: 100, durationMs: 400 } },
		type: "box" as const,
	},
	{
		children: ["heading", "carousel", "tabs", "faq", "map", "form"],
		key: "frame",
		props: frame,
		type: "flex" as const,
	},
	{
		children: [],
		key: "heading",
		props: { content: "heading", element: "h2", scrollReveal: true },
		type: "text" as const,
	},
	{
		children: ["slide-one-box", "slide-two-box"],
		key: "carousel",
		props: {
			arrows: true,
			autoplayMs: 5000,
			dots: true,
			dotsLabel: "dots-label",
			gap: "4sp",
			label: "car-label",
			loop: true,
			nextLabel: "car-next",
			previousLabel: "car-previous",
			slideBasis: { base: "100%", compact: "50%" },
		},
		type: "carousel" as const,
	},
	{ children: ["slide-one"], key: "slide-one-box", props: { fill: "subtle" }, type: "box" as const },
	{ children: ["slide-two"], key: "slide-two-box", props: { fill: "subtle" }, type: "box" as const },
	text("slide-one"),
	text("slide-two"),
	{
		children: ["item-one", "item-two"],
		key: "tabs",
		props: {
			autoplayMs: 6000,
			label: "tabs-label",
			orientation: "horizontal",
			panels: "crossfade",
			progress: true,
		},
		type: "tabs" as const,
	},
	item("item-one", "tab-one", "tab-one-panel"),
	item("item-two", "tab-two", "tab-two-panel"),
	text("tab-one", "span"),
	text("tab-one-panel"),
	text("tab-two", "span"),
	text("tab-two-panel"),
	{
		children: ["faq-item-1", "faq-item-2"],
		key: "faq",
		props: { defaultOpen: "first", divider: true, openIndicator: "rotate-180", triggerPadding: "4sp" },
		type: "disclosure" as const,
	},
	item("faq-item-1", "faq-q1-row", "faq-a1"),
	item("faq-item-2", "faq-q2", "faq-a2"),
	{
		children: ["faq-q1", "faq-chevron"],
		key: "faq-q1-row",
		props: { direction: "row", gap: "2sp" },
		type: "flex" as const,
	},
	text("faq-q1", "span"),
	{ children: [], key: "faq-chevron", props: { name: "chevron-down" }, type: "icon" as const },
	text("faq-q2", "span"),
	text("faq-a1"),
	text("faq-a2"),
	{
		children: [],
		key: "map",
		props: {
			address: "map-address",
			blockSize: "60sp",
			label: "map-label",
			provider: "google-map",
			radius: "theme",
			tint: true,
			zoom: 14,
		},
		type: "embed" as const,
	},
	{
		children: [],
		key: "form",
		props: {
			anotherLabel: "form-another",
			columns: 2,
			emailLabel: "form-email",
			error: "form-error",
			label: "form-label",
			messageLabel: "form-message",
			nameLabel: "form-name",
			pendingLabel: "form-pending",
			provider: "contact-form",
			submitLabel: "form-submit",
			submitWidth: "full",
			success: "form-success",
		},
		type: "embed" as const,
	},
];

const preorder = (nodes: ReturnType<typeof structureNodes>) => {
	const byKey = new Map(nodes.map((node) => [node.key, node]));

	const visit = (key: string): typeof nodes =>
		byKey.has(key) ? [byKey.get(key)!, ...byKey.get(key)!.children.flatMap(visit)] : [];

	return visit("surface");
};

const specification = (nodes = structureNodes(), overrides = {}) => ({
	content: content(overrides),
	structure: { nodes: preorder(nodes), root: "surface" },
});

const createSnapshot = () => ({
	assets: {},
	brand: testBrand,
	document: instantiateTemplate({
		content: nordicEdgeContent,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `composed-collections:${kind}:${path}` }),
		definition: nordicEdgeTemplate,
		path: "/composed-collections",
	}),
	schemaVersion: 1 as const,
	templateId: "nordic-edge",
});

const addSection = (spec: ReturnType<typeof specification>) =>
	editWebsiteSnapshot({
		input: {
			index: 0,
			operation: "add-composed-section" as const,
			pageId: createSnapshot().document.structure.pages[0]!.id,
			seed: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5e100",
			specification: spec,
		},
		snapshot: createSnapshot(),
	});

const issuesOf = (spec: ReturnType<typeof specification>) => {
	const parsed = composedSectionSpecificationSchema.safeParse(spec);

	return parsed.success ? [] : parsed.error.issues.map(({ message }) => message);
};

const withNode = (key: string, patch: Partial<SectionStructureNode>): Array<SectionStructureNode> =>
	structureNodes().map((node) => (node.key === key ? { ...node, ...patch } : node));

describe("composed collection nodes", () => {
	it("round-trips carousel, tabs, disclosure, embeds, and reveals through compose, render, and inspect", () => {
		const spec = specification();
		const updated = addSection(spec);
		const section = updated.document.structure.pages[0]!.sections[0]!;

		expect(inspectComposedSection({ document: updated.document, section })).toEqual({
			...composedSectionSpecificationSchema.parse(spec),
			logic: null,
		});

		const en = renderToStaticMarkup(<SiteRenderer brand={updated.brand} document={updated.document} locale='en' />);
		const ar = renderToStaticMarkup(<SiteRenderer brand={updated.brand} document={updated.document} locale='ar' />);

		expect(en).toContain('aria-roledescription="carousel"');
		expect(en).toContain("Second slide");
		expect(en).toContain("We build.");
		expect(en).toContain("How fast do you reply?");
		expect(en).toContain("maps.google.com");
		expect(en).toContain("Message");
		expect(ar).toContain("الشريحة الثانية");
		expect(ar).toContain("نبني.");
		expect(ar).toContain("ما سرعة ردكم؟");
		expect(ar).toContain("الرسالة");
		expect(ar).toContain('dir="rtl"');
		expect(ar).not.toContain("Second slide");
	});

	it("exposes collection copy as editable text targets", () => {
		const updated = addSection(specification());
		const section = updated.document.structure.pages[0]!.sections[0]!;
		const pointers = listSectionTextNodeReferences({ node: section.root }).map(({ pointer }) => pointer);

		expect(pointers).toEqual(
			expect.arrayContaining(["/copy/slide-two", "/copy/tab-two-panel", "/copy/faq-q1", "/copy/faq-a2"])
		);
	});

	it("keeps item identity stable across an unchanged re-add", () => {
		const first = addSection(specification());
		const second = addSection(specification());

		expect(first.document.structure.pages[0]!.sections[0]).toEqual(second.document.structure.pages[0]!.sections[0]);
	});

	it("rejects empty or blank collections", () => {
		expect(issuesOf(specification(withNode("carousel", { children: [] })))).toEqual(
			expect.arrayContaining([expect.stringContaining('carousel node "carousel" needs at least one slide')])
		);
		expect(issuesOf(specification(withNode("tabs", { children: [] })))).toEqual(
			expect.arrayContaining([expect.stringContaining('tabs node "tabs" needs at least one item')])
		);
		expect(issuesOf(specification(withNode("faq", { children: [] })))).toEqual(
			expect.arrayContaining([expect.stringContaining('disclosure node "faq" needs at least one item')])
		);
		expect(issuesOf(specification(structureNodes(), { "slide-one": [" ", " "], "slide-two": ["", ""] }))).toEqual(
			expect.arrayContaining([expect.stringContaining("has no nonblank text or media")])
		);
		expect(issuesOf(specification(structureNodes(), { "tab-one": ["  ", "  "] }))).toEqual(
			expect.arrayContaining([expect.stringContaining("trigger has no nonblank text")])
		);
	});

	it("requires contact-form labels in both locales and a map location", () => {
		expect(issuesOf(specification(structureNodes(), { "form-success": ["Thanks", "  "] }))).toEqual(
			expect.arrayContaining([expect.stringContaining('"form-success" is blank in ar')])
		);
		expect(issuesOf(specification(structureNodes(), { "map-address": ["   ", "   "] }))).toEqual(
			expect.arrayContaining([expect.stringContaining('address "map-address" is blank in en')])
		);

		const formWithoutSubmit = sectionStructureSchema.safeParse({
			nodes: [
				{ children: ["form"], key: "surface", props: {}, type: "box" },
				{
					children: [],
					key: "form",
					props: {
						anotherLabel: "form-another",
						emailLabel: "form-email",
						error: "form-error",
						label: "form-label",
						messageLabel: "form-message",
						nameLabel: "form-name",
						pendingLabel: "form-pending",
						provider: "contact-form",
						success: "form-success",
					},
					type: "embed",
				},
			],
			root: "surface",
		});

		expect(formWithoutSubmit.success).toBe(false);
		expect(
			issuesOf(
				specification(
					withNode("map", {
						props: { address: "map-address", label: "map-label", provider: "google-map", zoom: 40 },
					})
				)
			)
		).not.toEqual([]);
	});

	it("enforces item wiring and nested interactive rules", () => {
		const badTrigger = structureNodes().flatMap((node) =>
			node.key === "faq-q2"
				? [
						{
							children: ["faq-q2-label"],
							key: "faq-q2",
							props: { link: "faq-link" },
							type: "action" as const,
						},
						text("faq-q2-label", "span"),
					]
				: [node]
		);

		const nested = {
			...specification(badTrigger),
			content: {
				...content(),
				ar: { ...content().ar, "faq-q2-label": "اتصل بنا" },
				en: { ...content().en, "faq-q2-label": "Call us" },
				links: { "faq-link": { kind: "external" as const, url: "https://example.com" } },
			},
		};

		const stray = structureNodes().map((node) =>
			node.key === "frame" ? { ...node, children: [...node.children, "faq-item-1"] } : node
		);

		expect(issuesOf(nested)).toEqual(
			expect.arrayContaining([expect.stringContaining("cannot contain interactive or composite")])
		);
		expect(issuesOf(specification(withNode("faq", { children: ["slide-one"] })))).toEqual(
			expect.arrayContaining([expect.stringContaining("children must all be item nodes")])
		);
		expect(issuesOf(specification(stray))).toEqual(
			expect.arrayContaining([expect.stringContaining("must be a direct child of a tabs or disclosure")])
		);
		expect(
			sectionStructureSchema.safeParse({
				nodes: withNode("faq-item-1", { children: ["faq-q1-row"] }),
				root: "surface",
			}).success
		).toBe(false);
	});

	it("bounds carousel and tabs props", () => {
		expect(
			issuesOf(
				specification(withNode("carousel", { props: { arrows: true, label: "car-label", slideBasis: "100%" } }))
			)
		).toEqual(expect.arrayContaining([expect.stringContaining("previousLabel")]));
		expect(issuesOf(specification(withNode("tabs", { props: { label: "tabs-label", progress: true } })))).toEqual(
			expect.arrayContaining([expect.stringContaining("progress requires autoplayMs")])
		);
		expect(
			sectionStructureSchema.safeParse({
				nodes: withNode("carousel", { props: { autoplayMs: 100, label: "car-label", slideBasis: "100%" } }),
				root: "surface",
			}).success
		).toBe(false);
	});
});
