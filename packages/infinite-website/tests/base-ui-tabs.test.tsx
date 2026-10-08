import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import type { SiteDocument } from "../src/document/site-document-schema";
import type { PersistedSiteNode } from "../src/document/structure-schema";
import { SiteRenderer } from "../src/rendering/site-renderer";
import { entityIdFromSeed } from "../src/sections/entity-id";
import { testBrand } from "./fixtures/brand";

const pageId = entityIdFromSeed({ seed: "tabs:page" });

const sectionId = entityIdFromSeed({ seed: "tabs:section" });

const contentId = entityIdFromSeed({ seed: "tabs:content" });

const rootId = entityIdFromSeed({ seed: "tabs:root" });

const tabsId = entityIdFromSeed({ seed: "tabs:node" });

const residentialId = entityIdFromSeed({ seed: "tabs:residential" });

const commercialId = entityIdFromSeed({ seed: "tabs:commercial" });

type TabsExtra = Partial<Omit<Extract<PersistedSiteNode, { type: "tabs" }>["props"], "items" | "label">>;

const createDocument = ({ extra }: { extra?: TabsExtra } = {}): SiteDocument => ({
	content: {
		ar: {
			pages: { [pageId]: { route: { slug: "الرئيسية" }, seo: { title: "الرئيسية" } } },
			sections: {
				[contentId]: {
					commercial: { label: "تجاري", panel: "البيع بالتجزئة والضيافة" },
					label: "تفاصيل الخدمات",
					residential: { detail: "مطابخ وحمامات", label: "سكني", panel: "تجديد المنازل" },
				},
			},
			site: {},
		},
		en: {
			pages: { [pageId]: { route: { slug: "home" }, seo: { title: "Home" } } },
			sections: {
				[contentId]: {
					commercial: { label: "Commercial", panel: "Retail and hospitality" },
					label: "Service details",
					residential: { detail: "Kitchens and baths", label: "Residential", panel: "Home renovations" },
				},
			},
			site: {},
		},
	},
	defaultLocale: "en",
	documentVersion: 1,
	locales: ["en", "ar"],
	structure: {
		layout: { footer: [], header: [] },
		pages: [
			{
				home: true,
				id: pageId,
				sections: [
					{
						anchor: "services",
						category: "content",
						contentId,
						id: sectionId,
						root: {
							id: rootId,
							props: {
								children: [
									{
										id: tabsId,
										props: {
											defaultValue: "residential",
											...extra,
											items: [
												{
													detail: [
														{
															id: entityIdFromSeed({ seed: "tabs:residential:detail" }),
															props: {
																content: { $text: "/residential/detail" },
															},
															type: "text",
														},
													],
													id: residentialId,
													panel: [
														{
															id: entityIdFromSeed({ seed: "tabs:residential:panel" }),
															props: {
																content: { $text: "/residential/panel" },
															},
															type: "text",
														},
													],
													trigger: [
														{
															id: entityIdFromSeed({ seed: "tabs:residential:trigger" }),
															props: {
																content: { $text: "/residential/label" },
															},
															type: "text",
														},
													],
													value: "residential",
												},
												{
													id: commercialId,
													panel: [
														{
															id: entityIdFromSeed({ seed: "tabs:commercial:panel" }),
															props: {
																content: { $text: "/commercial/panel" },
															},
															type: "text",
														},
													],
													trigger: [
														{
															id: entityIdFromSeed({ seed: "tabs:commercial:trigger" }),
															props: {
																content: { $text: "/commercial/label" },
															},
															type: "text",
														},
													],
													value: "commercial",
												},
											],
											label: { $text: "/label" },
										},
										type: "tabs",
									},
								],
							},
							type: "box",
						},
						source: { pattern: "tabs" },
					},
				],
			},
		],
	},
});

const document = createDocument();

describe("Base UI tabs capability", () => {
	it("renders the tab anatomy from persisted structure", () => {
		const html = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} />);
		expect(html).toContain('role="tablist"');
		expect(html).toContain('role="tab"');
		expect(html).toContain('role="tabpanel"');
		expect(html).toContain("Home renovations");
	});

	it("resolves the same structure through the Arabic locale", () => {
		const html = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} locale='ar' />);
		expect(html).toContain('dir="rtl"');
		expect(html).toContain("تفاصيل الخدمات");
		expect(html).toContain("تجديد المنازل");
	});

	it("keeps every panel mounted and crossfading when panels is crossfade", () => {
		const html = renderToStaticMarkup(
			<SiteRenderer
				brand={testBrand}
				document={createDocument({ extra: { crossfadeMs: 400, panels: "crossfade" } })}
			/>
		);

		expect(html).toContain("Home renovations");
		expect(html).toContain("Retail and hospitality");
		expect(html).toContain("--iw-tab-fade:400ms");
	});

	it("links the detail region to its tab and exposes item status", () => {
		const html = renderToStaticMarkup(
			<SiteRenderer brand={testBrand} document={createDocument({ extra: { detailMode: "fade" } })} />
		);

		expect(html).toContain("Kitchens and baths");
		expect(html).toContain('data-mode="fade"');
		expect(html).toContain('aria-describedby="');
		expect(html).toContain('data-status="active"');
		expect(html).toContain('data-status="upcoming"');
	});

	it("renders decorations by scope without animating before hydration", () => {
		const html = renderToStaticMarkup(
			<SiteRenderer
				brand={testBrand}
				document={createDocument({
					extra: {
						autoplay: { intervalMs: 4000, startDelayMs: 300 },
						decorations: [
							{ axis: "inline", kind: "fill", scope: "not-last", source: "autoplay" },
							{ kind: "ring", size: "8sp", source: "autoplay" },
						],
					},
				})}
			/>
		);

		expect(html.match(/iw-tab-deco/gu)).toHaveLength(1);
		expect(html.match(/iw-tab-ring/gu)).toHaveLength(2);
		expect(html).toContain('data-autoplay="idle"');
		expect(html).toContain("--iw-tab-interval:4000ms");
		expect(html).toContain("--iw-tab-delay:300ms");
	});

	it("reports autoplay as off without an autoplay config", () => {
		const html = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} />);

		expect(html).toContain('data-autoplay="off"');
	});

	it("positions track panels from the active index and mirrors in Arabic", () => {
		const extra: TabsExtra = { panels: "track", slideBasis: "90%", slideGap: "1rem" };

		const english = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={createDocument({ extra })} />);

		const arabic = renderToStaticMarkup(
			<SiteRenderer brand={testBrand} document={createDocument({ extra })} locale='ar' />
		);

		expect(english).toContain("--iw-tab-dir:1");
		expect(english).toContain("--iw-tab-index:0");
		expect(arabic).toContain("--iw-tab-dir:-1");
	});

	it("renders an arrangement grid with leading nodes and an optional indicator", () => {
		const html = renderToStaticMarkup(
			<SiteRenderer
				brand={testBrand}
				document={createDocument({
					extra: {
						arrangement: { columns: 2, gap: "1rem" },
						indicator: false,
						lead: [
							{
								id: entityIdFromSeed({ seed: "tabs:lead" }),
								props: { content: { $text: "/label" }, element: "span" },
								type: "text",
							},
						],
					},
				})}
			/>
		);

		expect(html).toContain("iw-grid");
		expect(html).toContain("Service details");
		expect(html).not.toContain("--active-tab-width");
	});
});
