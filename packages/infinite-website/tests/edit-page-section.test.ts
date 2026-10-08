import { describe, expect, it } from "vitest";

import {
	createWebsiteSectionPreviewDocument,
	entityIdFromSeed,
	instantiateTemplate,
	resolveSectionContentReference,
	withBlogNavigation,
} from "@starter/infinite-website";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

import { editWebsitePageSection, WebsitePageSectionEditError } from "../src/document/edit-page-section";
import {
	createWebsiteSectionLayoutPreview,
	listWebsitePageSectionLayouts,
	listWebsiteSectionLayouts,
} from "../src/document/page-section-layout";
import { sectionDefinitions } from "../src/section-registry";

const createDocument = () => {
	return instantiateTemplate({
		content: nordicEdgeContent,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `edit-page-section:${kind}:${path}` }),
		definition: nordicEdgeTemplate,
		path: "/edit-page-section",
	});
};

const createClosingBannerTarget = () => {
	const document = createDocument();
	const page = document.structure.pages[0];
	const section = page?.sections.find((candidate) => candidate.anchor === "banner-card-and-background-image");

	if (!page || !section) {
		throw new Error("Expected the closing banner section");
	}

	return { document, page, section };
};

describe("website page section editing", () => {
	it("moves a section between adjacent positions without changing its identity", () => {
		const document = createDocument();
		const page = document.structure.pages[0];
		const first = page?.sections[0];
		const second = page?.sections[1];

		if (!page || !first || !second) {
			throw new Error("Expected two page sections");
		}

		const movedDown = editWebsitePageSection({
			document,
			operation: "move-down",
			pageId: page.id,
			sectionId: first.id,
		});

		expect(movedDown.structure.pages[0]?.sections.slice(0, 2)).toEqual([second, first]);

		const restored = editWebsitePageSection({
			document: movedDown,
			operation: "move-up",
			pageId: page.id,
			sectionId: first.id,
		});

		expect(restored).toEqual(document);
	});

	it("deletes a linked section and redirects its links to the page", () => {
		const { document, page, section } = createClosingBannerTarget();

		const updated = editWebsitePageSection({
			document,
			operation: "delete",
			pageId: page.id,
			sectionId: section.id,
		});

		expect(updated.structure.pages[0]?.sections).not.toContainEqual(section);
		expect(updated.content.en.sections[section.contentId]).toBeUndefined();
		expect(updated.content.ar?.sections[section.contentId]).toBeUndefined();
		expect(JSON.stringify(updated.content)).not.toContain(`"anchor":"${section.anchor}"`);
		expect(JSON.stringify(updated.content)).not.toContain(`"sectionId":"${section.id}"`);
	});

	it("swaps a section layout while preserving its stable identity and content join", () => {
		const document = createDocument();

		const target = document.structure.pages
			.flatMap((page) => page.sections.map((section) => ({ page, section })))
			.find(({ page, section }) =>
				listWebsitePageSectionLayouts({ document, pageId: page.id, sectionId: section.id }).some(
					({ generationRequired, pattern }) => pattern !== section.source.pattern && !generationRequired
				)
			);

		if (!target) {
			throw new Error("Expected a page section with a compatible alternate layout");
		}

		const { page, section } = target;

		const nextLayout = listWebsitePageSectionLayouts({
			document,
			pageId: page.id,
			sectionId: section.id,
		}).find(({ generationRequired, pattern }) => pattern !== section.source.pattern && !generationRequired);

		if (!nextLayout) {
			throw new Error("Expected an alternate section layout");
		}

		const updated = editWebsitePageSection({
			document,
			operation: "swap-layout",
			pageId: page.id,
			pattern: nextLayout.pattern,
			sectionId: section.id,
		});

		const replacement = updated.structure.pages
			.find((candidate) => candidate.id === page.id)
			?.sections.find((candidate) => candidate.id === section.id);

		expect(replacement).toMatchObject({
			anchor: section.anchor,
			contentId: section.contentId,
			id: section.id,
			source: { pattern: nextLayout.pattern },
		});

		expect(updated.content.en.sections[section.contentId]).toBeDefined();
		expect(updated.content.ar?.sections[section.contentId]).toBeDefined();

		expect(document.structure.pages.find((candidate) => candidate.id === page.id)?.sections).toContainEqual(
			section
		);

		const sourceTextPointer = JSON.stringify(section.root).match(/"\$text":"([^"]+)"/u)?.[1];
		const replacementTextPointer = JSON.stringify(replacement?.root).match(/"\$text":"([^"]+)"/u)?.[1];

		if (!sourceTextPointer || !replacementTextPointer) {
			throw new Error("Expected source and replacement text references");
		}

		expect(
			resolveSectionContentReference({
				content: updated.content,
				contentId: section.contentId,
				defaultLocale: updated.defaultLocale,
				locale: "en",
				reference: { $text: replacementTextPointer },
			})
		).toBe(
			resolveSectionContentReference({
				content: document.content,
				contentId: section.contentId,
				defaultLocale: document.defaultLocale,
				locale: "en",
				reference: { $text: sourceTextPointer },
			})
		);
	});

	it("does not offer layouts whose semantic content contract would corrupt copy", () => {
		const { document, page, section } = createClosingBannerTarget();

		const layouts = listWebsitePageSectionLayouts({ document, pageId: page.id, sectionId: section.id });

		expect(layouts[0]).toEqual({ generationRequired: false, pattern: section.source.pattern });
		expect(layouts).toContainEqual({ generationRequired: true, pattern: "banner-double-carousel" });

		const preview = createWebsiteSectionLayoutPreview({
			document,
			pattern: "banner-double-carousel",
			target: { area: "page", index: page.sections.indexOf(section), pageId: page.id, sectionId: section.id },
		});

		expect(preview?.structure.pages[0]?.sections.find((candidate) => candidate.id === section.id)).toMatchObject({
			contentId: section.contentId,
			id: section.id,
			source: { pattern: "banner-double-carousel" },
		});

		expect(document.structure.pages[0]?.sections).toContainEqual(section);

		expect(() =>
			editWebsitePageSection({
				document,
				operation: "swap-layout",
				pageId: page.id,
				pattern: "banner-double-carousel",
				sectionId: section.id,
			})
		).toThrow(WebsitePageSectionEditError);
	});

	it("offers every header layout even when new elements require generation", () => {
		const document = createDocument();
		const header = document.structure.layout.header[0];

		if (!header) {
			throw new Error("Expected a header section");
		}

		const layouts = listWebsiteSectionLayouts({
			document,
			target: { area: "header", index: 0, sectionId: header.id },
		});

		const headerPatterns = sectionDefinitions
			.filter(({ category }) => category === "header")
			.map(({ pattern }) => pattern);

		expect(layouts.map(({ pattern }) => pattern)).toEqual(expect.arrayContaining(headerPatterns));
		expect(layouts).toHaveLength(headerPatterns.length);
		expect(layouts.some(({ generationRequired }) => generationRequired)).toBe(true);
	});

	it("previews every header layout after adding editor-owned Blog navigation", () => {
		const document = withBlogNavigation(createDocument());
		const original = structuredClone(document);
		const header = document.structure.layout.header[0];
		const home = document.structure.pages.find(({ home }) => home);

		if (!header || !home?.sections[0]) {
			throw new Error("Expected a header and a home section");
		}

		const target = { area: "header" as const, index: 0, sectionId: header.id };

		for (const { pattern } of listWebsiteSectionLayouts({ document, target })) {
			const preview = createWebsiteSectionLayoutPreview({ document, pattern, target });
			const candidate = preview?.structure.layout.header[0];
			expect(candidate?.source?.pattern).toBe(pattern);

			if (!preview || !candidate) {
				throw new Error("Expected a header layout preview");
			}

			const thumbnail = createWebsiteSectionPreviewDocument({ document: preview, section: candidate, target });
			expect(thumbnail.structure.pages.find(({ home }) => home)?.sections).toEqual([home.sections[0]]);
			expect(Object.keys(thumbnail.content.en.sections)).toHaveLength(2);
		}

		expect(document).toEqual(original);
	}, 30_000);

	it("rejects missing and out-of-range section operations", () => {
		const document = createDocument();
		const page = document.structure.pages[0];
		const first = page?.sections[0];

		if (!page || !first) {
			throw new Error("Expected a page section");
		}

		expect(() =>
			editWebsitePageSection({
				document,
				operation: "move-up",
				pageId: page.id,
				sectionId: first.id,
			})
		).toThrow(WebsitePageSectionEditError);

		expect(() =>
			editWebsitePageSection({
				document,
				operation: "delete",
				pageId: page.id,
				sectionId: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d399",
			})
		).toThrow(WebsitePageSectionEditError);
	});
});
