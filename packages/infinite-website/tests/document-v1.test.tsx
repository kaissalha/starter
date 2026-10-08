import { renderToStaticMarkup } from "react-dom/server";

import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import {
	decodeContentPointer,
	encodeContentPointer,
	findCollectionItem,
	authoringJsonObjectSchema,
	resolveSectionContentReference,
	textReferenceSchema,
	type AuthoringJsonValue,
} from "../src/document/content-schema";
import { parseSiteDocument, validateSiteDocument } from "../src/document/document-validation";
import { siteDocumentJsonSchema, type SiteDocument } from "../src/document/site-document-schema";
import type { SiteLinkProps } from "../src/primitives/shared";
import {
	SitePreviewRenderer,
	type SitePreviewInsertionGapProps,
	type SitePreviewSectionProps,
} from "../src/rendering/site-preview-renderer";
import { SiteRenderer } from "../src/rendering/site-renderer";
import { entityIdFromSeed } from "../src/sections/entity-id";
import { faqAccordionSection } from "../src/sections/faq/faq-accordion";
import { bannerTextOnlySection } from "../src/sections/hero/banner-text-only";
import { defineSection, instantiateSection, type CreateEntityId } from "../src/sections/section-definition";
import faqAccordionFixtures from "../src/storybook/fixtures/sections/faq/faq-accordion.json";
import bannerTextOnlyFixtures from "../src/storybook/fixtures/sections/hero/banner-text-only.json";
import { testBrand } from "./fixtures/brand";
import { singlePageStructure } from "./fixtures/structure";

const createId: CreateEntityId = ({ kind, path }) => {
	return entityIdFromSeed({ seed: `document-v1:${kind}:${path}` });
};

const FrameworkLink = ({ children, href, ...props }: SiteLinkProps) => {
	return (
		<a {...props} data-framework-link='true' href={href}>
			{children}
		</a>
	);
};

const PreviewSection = ({ children, section }: SitePreviewSectionProps) => (
	<div data-preview-section={section.id}>{children}</div>
);

const PreviewGap = ({ target }: SitePreviewInsertionGapProps) => (
	<div data-preview-gap={`${target.pageId}:${target.index}`} />
);

const pageId = createId({ kind: "page", path: "/page" });

const heroContent = Object.fromEntries(
	Object.entries(bannerTextOnlyFixtures).map(([locale, content]) => [
		locale,
		{
			...content,
			actions: content.actions.map((action) => ({ ...action, link: { kind: "relative", path: "/contact" } })),
		},
	])
);

const instance = instantiateSection({
	anchor: "hero",
	content: heroContent,
	createId,
	defaultLocale: "en",
	definition: bannerTextOnlySection,
	path: "/hero",
});

const faqInstance = instantiateSection({
	anchor: "faq",
	content: faqAccordionFixtures,
	createId,
	defaultLocale: "en",
	definition: faqAccordionSection,
	path: "/faq",
});

const document: SiteDocument = {
	content: {
		ar: {
			pages: { [pageId]: { route: { slug: "الرئيسية" }, seo: { title: "مثال" } } },
			sections: { [instance.section.contentId]: instance.content.ar },
			site: { name: "مثال" },
		},
		en: {
			pages: { [pageId]: { route: { slug: "home" }, seo: { title: "Example" } } },
			sections: { [instance.section.contentId]: instance.content.en },
			site: { name: "Example" },
		},
	},
	defaultLocale: "en",
	documentVersion: 1,
	locales: ["en", "ar"],
	structure: singlePageStructure({ pageId, sections: [instance.section] }),
};

const isAuthoringJsonObject = (value: AuthoringJsonValue): value is AuthoringJsonObject => {
	return authoringJsonObjectSchema.safeParse(value).success;
};

const replaceFirstTextReference = ({
	replacement,
	value,
}: {
	replacement: AuthoringJsonValue;
	value: AuthoringJsonValue;
}): boolean => {
	if (Array.isArray(value)) {
		return value.some((item) => replaceFirstTextReference({ replacement, value: item }));
	}

	const parsed = authoringJsonObjectSchema.safeParse(value);

	if (!parsed.success) {
		return false;
	}

	const replaced = Object.entries(parsed.data).some(([key, child]) => {
		if (textReferenceSchema.safeParse(child).success) {
			parsed.data[key] = replacement;

			return true;
		}

		return replaceFirstTextReference({ replacement, value: child });
	});

	if (replaced) {
		Object.assign(value, parsed.data);
	}

	return replaced;
};

describe("Infinite Website document v1", () => {
	it("parses the runtime schema and compiles the generated Draft 2020-12 JSON Schema", () => {
		expect(parseSiteDocument(document)).toEqual(document);
		expect(instance.section.source).toEqual({ pattern: bannerTextOnlySection.pattern });
		const ajv = new Ajv2020({ strict: false });
		addFormats(ajv);
		const validate = ajv.compile(siteDocumentJsonSchema);
		expect(validate(document)).toBe(true);
		expect(validate({ ...document, documentVersion: 2 })).toBe(false);
	}, 15_000);

	it("keeps literal content out of persisted nodes and validates graph completeness", () => {
		const invalid = structuredClone(document);
		expect(replaceFirstTextReference({ replacement: "not allowed", value: invalid.structure })).toBe(true);
		expect(validateSiteDocument(invalid)).toMatchObject({ success: false });

		const missing = structuredClone(document);
		const defaultSectionContent = missing.content.en.sections[instance.section.contentId];

		if (!defaultSectionContent || !isAuthoringJsonObject(defaultSectionContent.copy)) {
			throw new Error("Expected default hero copy");
		}

		delete defaultSectionContent.copy["heading"];

		expect(validateSiteDocument(missing)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: "invalid_section_content" })]),
			success: false,
		});
	});

	it("rejects a section root node ID that collides with its section entity", () => {
		const invalid = structuredClone(document);
		const section = invalid.structure.pages[0]!.sections[0]!;
		section.root.id = section.id;

		expect(validateSiteDocument(invalid)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: "duplicate_entity_id",
					path: ["structure", "pages", 0, "sections", 0, "root", "id"],
				}),
			]),
			success: false,
		});
	});

	it("rejects duplicate root node IDs across sections", () => {
		const invalid = structuredClone(document);
		const page = invalid.structure.pages[0]!;
		const faqSection = structuredClone(faqInstance.section);

		if (!faqInstance.content.en || !faqInstance.content.ar) {
			throw new Error("Expected complete FAQ content");
		}

		faqSection.anchor = "faq";
		faqSection.root.id = page.sections[0]!.root.id;
		page.sections.push(faqSection);
		invalid.content.en.sections[faqSection.contentId] = faqInstance.content.en;
		invalid.content.ar.sections[faqSection.contentId] = faqInstance.content.ar;

		expect(validateSiteDocument(invalid)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: "duplicate_entity_id",
					path: ["structure", "pages", 0, "sections", 1, "root", "id"],
				}),
			]),
			success: false,
		});
	});

	it("rejects the removed untyped content reference shape", () => {
		const invalid = structuredClone(document);

		expect(
			replaceFirstTextReference({ replacement: { $content: "/copy/heading" }, value: invalid.structure })
		).toBe(true);

		expect(validateSiteDocument(invalid)).toMatchObject({ success: false });
	});

	it("resolves locale overlays per semantic pointer and falls back to the default locale", () => {
		const fallbackDocument = structuredClone(document);
		const arabicContent = fallbackDocument.content.ar.sections[instance.section.contentId];

		if (!arabicContent || !isAuthoringJsonObject(arabicContent.copy)) {
			throw new Error("Expected Arabic hero copy");
		}

		delete arabicContent.copy["heading"];

		expect(
			resolveSectionContentReference({
				content: fallbackDocument.content,
				contentId: instance.section.contentId,
				defaultLocale: "en",
				locale: "ar",
				reference: { $text: "/copy/heading" },
			})
		).toBe("We make real gardens for real people");
	});

	it("renders v1 through one locale and direction boundary", () => {
		const html = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} locale='ar' />);
		expect(html).toContain('dir="rtl"');
		expect(html).toContain('lang="ar"');
		expect(html).toContain("نصنع حدائق حقيقية");
		expect(html).toContain(`id="${instance.section.id}"`);
		expect(html).toContain('href="/contact"');
		expect(html).toContain('data-action="relative"');
	});

	it("adds preview wrappers and exact insertion gaps without changing the document", () => {
		const html = renderToStaticMarkup(
			<SitePreviewRenderer
				brand={testBrand}
				document={document}
				insertionGapComponent={PreviewGap}
				sectionComponent={PreviewSection}
			/>
		);

		expect(html).toContain(`data-preview-section="${instance.section.id}"`);
		expect(html).toContain(`data-preview-gap="${pageId}:0"`);
		expect(html).toContain(`data-preview-gap="${pageId}:1"`);
		expect(parseSiteDocument(document)).toEqual(document);
	});

	it("exposes typed link and repeatable disclosure targets to preview controls", () => {
		const faqDocument = structuredClone(document);
		const page = faqDocument.structure.pages[0];

		if (
			!page ||
			!faqDocument.content.en ||
			!faqDocument.content.ar ||
			!faqInstance.content.en ||
			!faqInstance.content.ar
		) {
			throw new Error("Expected complete preview document content");
		}

		page.sections = [instance.section, { ...faqInstance.section, anchor: "contact" }];
		faqDocument.content.en.sections[faqInstance.section.contentId] = faqInstance.content.en;
		faqDocument.content.ar.sections[faqInstance.section.contentId] = faqInstance.content.ar;

		const html = renderToStaticMarkup(
			<SitePreviewRenderer
				brand={testBrand}
				disclosureItemControls={(target) => (
					<span data-collection={target.collection} data-disclosure-item={target.contentItemId} />
				)}
				document={faqDocument}
				linkElementProps={(target) => ({
					"data-link-label": target.labels[0]?.content,
					"data-link-pointer": target.pointer,
				})}
				sectionComponent={PreviewSection}
			/>
		);

		expect(html).toContain('data-link-pointer="/actions/items/');
		expect(html).toContain('data-link-label="Schedule a call"');
		expect(html.match(/data-disclosure-item=/gu)).toHaveLength(faqAccordionFixtures.en.items.length);
		expect(html).toContain('data-collection="/items"');
	});

	it("selects localized page slugs and returns nothing for an unknown page", () => {
		expect(
			renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} locale='ar' pageSlug='الرئيسية' />)
		).toContain("نصنع حدائق حقيقية");

		expect(renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} pageSlug='missing' />)).toBe(
			""
		);
	});

	it("prefixes root-relative links when mounted below the domain root", () => {
		const html = renderToStaticMarkup(
			<SiteRenderer basePath='/sites/website-1' brand={testBrand} document={document} />
		);

		expect(html).toContain('href="/sites/website-1/contact"');
	});

	it("renders links with the host framework adapter", () => {
		const html = renderToStaticMarkup(
			<SiteRenderer brand={testBrand} document={document} linkComponent={FrameworkLink} />
		);

		expect(html).toContain('href="/contact"');
		expect(html).toContain('data-framework-link="true"');
		expect(html).toContain('data-action="relative"');
	});

	it("round-trips RFC 6901 segments and identifies strict collection indexes", () => {
		const segments = ["groups/featured", "tilde~key", "items", "0", "label"];
		const pointer = encodeContentPointer({ segments });

		expect(pointer).toBe("/groups~1featured/tilde~0key/items/0/label");
		expect(decodeContentPointer({ pointer })).toEqual(segments);

		expect(findCollectionItem({ pointer })).toMatchObject({
			collectionPointer: "/groups~1featured/tilde~0key",
			item: "0",
		});
	});

	it("preserves escaped collection keys when definitions become persisted sections", () => {
		const definition = defineSection({
			category: "content",
			pattern: "escaped-collection-test",
			root: {
				props: {
					children: [
						{
							props: { content: { $text: "/groups~1featured/items/0/label" } },
							type: "text",
						},
					],
				},
				type: "box",
			},
		});

		const instance = instantiateSection({
			anchor: "featured",
			content: { en: { "groups/featured": [{ label: "Featured" }] } },
			createId: ({ kind, path }) => entityIdFromSeed({ seed: `${kind}:${path}` }),
			defaultLocale: "en",
			definition,
			path: "/escaped",
		});

		const child = instance.section.root.props.children[0];

		expect(child?.type).toBe("text");

		if (child?.type !== "text") {
			throw new Error("Expected a text child");
		}

		expect(child.props.content.$text).toMatch(/^\/groups~1featured\/items\/[0-9a-f-]+\/label$/u);
	});
});
