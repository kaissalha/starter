import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import {
	entityIdFromSeed,
	instantiateTemplate,
	SiteRenderer,
	validateSiteDocument,
	type CreateEntityId,
	type LinkValue,
} from "@starter/infinite-website";
import { getSectionCatalog, templateCatalog } from "@starter/infinite-website/catalog";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";
import { urbanEdgeTemplate } from "@starter/infinite-website/templates/urban-edge";
import urbanEdgeContent from "@starter/infinite-website/templates/urban-edge/content";

import { templateDefinitions } from "../src/catalog";
import { isJsonObject, jsonObjectSchema, linkValueSchema, type JsonValue } from "../src/document/content-schema";
import { sectionDefinitions } from "../src/section-registry";
import { testBrand } from "./fixtures/brand";

const createId: CreateEntityId = ({ kind, path }) => {
	return entityIdFromSeed({ seed: `document-contract:${kind}:${path}` });
};

const createDocument = () => {
	return instantiateTemplate({
		content: nordicEdgeContent,
		createId,
		definition: nordicEdgeTemplate,
		path: "/nordic-edge",
	});
};

const createMapDocument = () => {
	return instantiateTemplate({
		content: urbanEdgeContent,
		createId,
		definition: urbanEdgeTemplate,
		path: "/urban-edge",
	});
};

const createTwoPageDocument = () => {
	const document = createDocument();
	const sourcePage = document.structure.pages[0];
	const targetSection = sourcePage?.sections.pop();
	const targetPageId = entityIdFromSeed({ seed: "document-contract:target-page" });

	if (!sourcePage || !targetSection) {
		throw new Error("Expected a source page and target section");
	}

	document.structure.pages.push({ home: false, id: targetPageId, sections: [targetSection] });
	document.locales.forEach((locale) => {
		const localized = document.content[locale];
		const sourcePageContent = localized?.pages[sourcePage.id];

		if (!localized || !sourcePageContent) {
			throw new Error(`Expected ${locale} page content`);
		}

		localized.pages[targetPageId] = {
			...sourcePageContent,
			route: { slug: `${sourcePageContent.route.slug}-details` },
		};
	});

	return { document, targetSection };
};

const replaceHeaderLinks = ({ document, first }: { document: ReturnType<typeof createDocument>; first: LinkValue }) => {
	const header = document.structure.layout.header[0];

	if (!header) {
		throw new Error("Expected a header section");
	}

	const locale = document.defaultLocale;
	const headerContent = document.content[locale]?.sections[header.contentId];
	const navigation = jsonObjectSchema.safeParse(headerContent?.navigation);
	const items = jsonObjectSchema.safeParse(navigation.success ? navigation.data.items : undefined);
	const order = navigation.success ? navigation.data.order : undefined;

	if (!headerContent || !navigation.success || !items.success || !Array.isArray(order) || !order[0]) {
		throw new Error(`Expected ${locale} header navigation`);
	}

	order.forEach((itemId, index) => {
		const item = jsonObjectSchema.safeParse(items.data[String(itemId)]);

		if (!item.success) {
			throw new Error(`Expected ${locale} header navigation item`);
		}

		item.data.link = index === 0 ? first : { kind: "relative", path: "/" };
		items.data[String(itemId)] = item.data;
	});
	navigation.data.items = items.data;
	headerContent.navigation = navigation.data;

	return header.contentId;
};

const replaceFirstLocalizedAnchorWithOverlay = ({
	document,
	overlay,
}: {
	document: ReturnType<typeof createDocument>;
	overlay: Record<string, string>;
}) => {
	const pending: Array<JsonValue> = Object.values(document.content.ar);

	while (pending.length > 0) {
		const current = pending.pop();

		if (Array.isArray(current)) {
			pending.push(...current);
			continue;
		}

		if (!isJsonObject(current)) {
			continue;
		}

		const link = linkValueSchema.safeParse(current.link);

		if (link.success && link.data.kind === "anchor") {
			current.link = overlay;

			return;
		}

		pending.push(...Object.values(current));
	}

	throw new Error("Expected localized anchor link content");
};

describe("Infinite Website document contracts", () => {
	it("admits only safe, kind-specific links", () => {
		expect(linkValueSchema.safeParse({ kind: "external", url: "https://starter.dev" }).success).toBe(true);
		expect(linkValueSchema.safeParse({ kind: "external", url: "javascript:alert(1)" }).success).toBe(false);
		expect(linkValueSchema.safeParse({ kind: "booking", url: "data:text/html,unsafe" }).success).toBe(false);
		expect(linkValueSchema.safeParse({ kind: "relative", path: "//example.com" }).success).toBe(false);
		expect(linkValueSchema.safeParse({ kind: "phone", number: "not-a-phone-number" }).success).toBe(false);
	});

	it("rejects invalid routes, orphan content, missing anchors, and broken collection identity", () => {
		const invalidRoute = createDocument();
		const pageId = invalidRoute.structure.pages[0]?.id;

		if (!pageId) {
			throw new Error("Expected a template page");
		}

		Reflect.set(invalidRoute.content.en.pages[pageId]?.route ?? {}, "slug", 42);
		expect(validateSiteDocument(invalidRoute)).toMatchObject({ success: false });

		const orphan = createDocument();
		orphan.content.en.sections[entityIdFromSeed({ seed: "orphan" })] = {};

		expect(validateSiteDocument(orphan)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: "invalid_section_content_join" })]),
			success: false,
		});

		const missingAnchor = createDocument();

		const bookSection = missingAnchor.structure.pages[0]?.sections.find(
			(section) => section.anchor === "banner-card-and-background-image"
		);

		if (!bookSection) {
			throw new Error("Expected the Nordic Edge booking section");
		}

		bookSection.anchor = "booking";

		expect(validateSiteDocument(missingAnchor)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: "missing_link_anchor" })]),
			success: false,
		});

		const brokenCollection = createDocument();
		const header = brokenCollection.structure.layout.header[0];
		const headerContent = header ? brokenCollection.content.en.sections[header.contentId] : undefined;
		const navigation = headerContent?.navigation;
		const parsedNavigation = jsonObjectSchema.safeParse(navigation);

		if (!parsedNavigation.success) {
			throw new Error("Expected persisted header navigation");
		}

		const order = parsedNavigation.data.order;

		if (!Array.isArray(order)) {
			throw new Error("Expected persisted navigation order");
		}

		order.pop();
		headerContent.navigation = parsedNavigation.data;

		expect(validateSiteDocument(brokenCollection)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: "invalid_collection_identity" })]),
			success: false,
		});
	});

	it("rejects page slugs shadowed by the public website route namespace", () => {
		const localePrefixCollision = createDocument();
		const localePrefixPageId = localePrefixCollision.structure.pages[0]?.id;

		if (!localePrefixPageId) {
			throw new Error("Expected a template page");
		}

		localePrefixCollision.content.en.pages[localePrefixPageId]!.route.slug = "ar/services";

		expect(validateSiteDocument(localePrefixCollision)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: "page_slug_locale_prefix_collision" })]),
			success: false,
		});

		const reservedRouteCollision = createDocument();
		const reservedRoutePageId = reservedRouteCollision.structure.pages[0]?.id;

		if (!reservedRoutePageId) {
			throw new Error("Expected a template page");
		}

		reservedRouteCollision.content.ar.pages[reservedRoutePageId]!.route.slug = "brand-guidelines";

		expect(validateSiteDocument(reservedRouteCollision)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: "reserved_page_slug" })]),
			success: false,
		});

		reservedRouteCollision.content.ar.pages[reservedRoutePageId]!.route.slug = "links";

		expect(validateSiteDocument(reservedRouteCollision)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: "reserved_page_slug" })]),
			success: false,
		});
	});

	it("routes omitted page anchors through their localized page while retaining shell fragments", () => {
		const { document, targetSection } = createTwoPageDocument();
		const home = document.structure.pages.find((page) => page.home);
		const homeSection = home?.sections[0];
		const header = document.structure.layout.header[0];
		const other = document.structure.pages.find((page) => !page.home);

		if (!homeSection || !header || !other) {
			throw new Error("Missing shell fixture");
		}

		for (const locale of ["en", "ar"] as const) {
			const basePath = locale === "ar" ? "/ar" : "";
			document.content[locale].sections[header.contentId] = structuredClone(
				document.content.en.sections[header.contentId]
			);
			const path = document.content[locale].pages[other.id]?.route.slug;

			for (const { prefix, section } of [
				{ prefix: basePath || "/", section: homeSection },
				{ prefix: `${basePath}/${path}`, section: targetSection },
				{ prefix: "", section: header },
			]) {
				for (const first of [
					{ kind: "section", sectionId: section.id },
					{ anchor: section.anchor, kind: "anchor" },
				] satisfies Array<LinkValue>) {
					replaceHeaderLinks({ document: { ...document, defaultLocale: locale }, first });

					const html = renderToStaticMarkup(
						<SiteRenderer
							basePath={basePath}
							brand={testBrand}
							document={document}
							locale={locale}
							pageContent={<article>Blog</article>}
						/>
					);

					expect(html).toContain(`href="${prefix}#${section.id}"`);
				}
			}
		}
	});

	it("rejects local section and anchor links to sections on another rendered page", () => {
		const sectionFixture = createTwoPageDocument();

		const sectionHeaderContentId = replaceHeaderLinks({
			document: sectionFixture.document,
			first: { kind: "section", sectionId: sectionFixture.targetSection.id },
		});

		const sectionResult = validateSiteDocument(sectionFixture.document);

		expect(sectionResult).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: "cross_page_section_link",
					path: expect.arrayContaining([sectionHeaderContentId]),
				}),
			]),
			success: false,
		});

		const anchorFixture = createTwoPageDocument();

		const anchorHeaderContentId = replaceHeaderLinks({
			document: anchorFixture.document,
			first: { anchor: anchorFixture.targetSection.anchor, kind: "anchor" },
		});

		const anchorResult = validateSiteDocument(anchorFixture.document);

		expect(anchorResult).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: "cross_page_anchor_link",
					path: expect.arrayContaining([anchorHeaderContentId]),
				}),
			]),
			success: false,
		});
	});

	it("validates fully merged localized link overlays before rendering", () => {
		const missingTarget = createDocument();
		replaceFirstLocalizedAnchorWithOverlay({ document: missingTarget, overlay: { anchor: "missing" } });

		expect(validateSiteDocument(missingTarget)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: "missing_link_anchor" })]),
			success: false,
		});

		const crossPage = createTwoPageDocument();
		replaceFirstLocalizedAnchorWithOverlay({
			document: crossPage.document,
			overlay: { anchor: crossPage.targetSection.anchor },
		});

		expect(validateSiteDocument(crossPage.document)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: "cross_page_anchor_link" })]),
			success: false,
		});

		const validTarget = createDocument();
		replaceFirstLocalizedAnchorWithOverlay({
			document: validTarget,
			overlay: { anchor: "banner-card-and-background-image" },
		});
		expect(validateSiteDocument(validTarget)).toMatchObject({ success: true });
		expect(() =>
			renderToStaticMarkup(<SiteRenderer brand={testBrand} document={validTarget} locale='ar' />)
		).not.toThrow();
	});

	it("uses persisted collection order when rendering fixed-card patterns", () => {
		const document = createDocument();
		const original = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} />);
		const header = document.structure.layout.header[0];
		const headerContent = header ? document.content.en.sections[header.contentId] : undefined;
		const navigation = headerContent?.navigation;
		const parsedNavigation = jsonObjectSchema.safeParse(navigation);

		if (!parsedNavigation.success) {
			throw new Error("Expected persisted header navigation");
		}

		const order = parsedNavigation.data.order;

		if (!Array.isArray(order)) {
			throw new Error("Expected persisted navigation order");
		}

		order.reverse();
		headerContent.navigation = parsedNavigation.data;
		expect(validateSiteDocument(document)).toMatchObject({ success: true });
		expect(renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} />)).not.toBe(original);
	});

	it("renders semantic anchors through real section identities", () => {
		const document = createDocument();

		const bookingSection = document.structure.pages[0]?.sections.find(
			(section) => section.anchor === "banner-card-and-background-image"
		);

		if (!bookingSection) {
			throw new Error("Expected the Nordic Edge booking section");
		}

		const html = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} />);
		expect(html).toContain(`href="#${bookingSection.id}"`);
		expect(html).toContain(`id="${bookingSection.id}"`);
	});

	it("stores and validates non-localized section settings", () => {
		const document = createMapDocument();

		const mapSection = document.structure.pages[0]?.sections.find(
			(section) => section.source.pattern === "location-map"
		);

		const mapSettings = jsonObjectSchema.safeParse(mapSection?.settings?.map);

		if (!mapSection?.settings || !mapSettings.success) {
			throw new Error("Expected map section settings");
		}

		mapSection.settings.map = { ...mapSettings.data, zoom: 12 };
		expect(validateSiteDocument(document)).toMatchObject({ success: true });
		expect(renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} />)).toContain("z=12");

		mapSection.settings.map = { ...mapSettings.data, zoom: 30 };

		expect(validateSiteDocument(document)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: "invalid_section_settings" })]),
			success: false,
		});
	});

	it("publishes one serializable catalog for every shipped pattern and template", () => {
		const sectionCatalog = getSectionCatalog();

		expect(sectionCatalog.map(({ id }) => id)).toEqual(sectionDefinitions.map(({ pattern }) => pattern));
		expect(templateCatalog.map(({ id }) => id)).toEqual(templateDefinitions.map(({ id }) => id));

		expect(sectionCatalog.find((section) => section.id === "banner-text-only")?.contentSchema).toMatchObject({
			type: "object",
		});

		expect(sectionCatalog.find((section) => section.id === "location-map")?.settingsSchema).toMatchObject({
			type: "object",
		});

		expect(templateCatalog.find((template) => template.id === "nordic-edge")).toMatchObject({
			description: nordicEdgeTemplate.description,
		});
	});
});
