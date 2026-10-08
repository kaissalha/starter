import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

import {
	createWebsiteSectionPreviewDocument,
	entityIdFromSeed,
	instantiateTemplate,
	SiteRenderer,
	type CreateEntityId,
} from "@starter/infinite-website";
import { SitePreviewRenderer } from "@starter/infinite-website/preview";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";
import { trueExposureTemplate } from "@starter/infinite-website/templates/true-exposure";
import trueExposureContent from "@starter/infinite-website/templates/true-exposure/content";

import { listSectionLinkElementReferences } from "../src/document/section-content-references";
import { sectionRegistry } from "../src/section-registry";
import { testBrand } from "./fixtures/brand";

const createId: CreateEntityId = ({ kind, path }) => {
	return entityIdFromSeed({ seed: `preview-text-editing:${kind}:${path}` });
};

const document = instantiateTemplate({
	content: nordicEdgeContent,
	createId,
	definition: nordicEdgeTemplate,
	path: "/preview-text-editing",
});

const menuDocument = instantiateTemplate({
	content: trueExposureContent,
	createId,
	definition: trueExposureTemplate,
	path: "/preview-menu-editing",
});

const PreviewSection = ({ children }: { children: ReactNode }) => {
	return <>{children}</>;
};

describe("preview text editing metadata", () => {
	it("exposes stable section and content pointers only through the preview renderer", () => {
		const resolveTextElementProps = vi.fn(({ pointer }: { pointer: string }) => ({
			"data-edit-pointer": pointer,
		}));

		const resolveLinkElementProps = vi.fn(({ pointer }: { pointer: string }) => ({
			"data-link-pointer": pointer,
		}));

		const preview = renderToStaticMarkup(
			<SitePreviewRenderer
				brand={testBrand}
				document={document}
				linkElementProps={resolveLinkElementProps}
				sectionComponent={PreviewSection}
				textElementProps={resolveTextElementProps}
			/>
		);

		const published = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} />);

		expect(resolveTextElementProps).toHaveBeenCalledWith(
			expect.objectContaining({
				content: expect.any(String),
				contentId: expect.any(String),
				locale: "en",
				nodeId: expect.any(String),
				pointer: expect.stringMatching(/^\//u),
				sectionId: expect.any(String),
			})
		);

		expect(resolveTextElementProps).toHaveBeenCalledWith(expect.objectContaining({ linkLabel: true }));

		expect(resolveLinkElementProps).toHaveBeenCalledWith(
			expect.objectContaining({
				elementType: "menu",
				labels: expect.arrayContaining([
					expect.objectContaining({ content: expect.any(String), pointer: expect.stringMatching(/^\//u) }),
				]),
			})
		);

		expect(preview).toContain("data-edit-pointer=");
		expect(preview).toContain("data-link-pointer=");
		expect(published).not.toContain("data-edit-pointer=");
		expect(published).not.toContain("data-link-pointer=");
	});

	it("attaches one menu editor to desktop, mobile, and dropdown labels", () => {
		const resolveLinkElementProps = vi.fn(({ pointer }: { pointer: string }) => ({
			"data-link-pointer": pointer,
		}));

		const preview = renderToStaticMarkup(
			<SitePreviewRenderer
				brand={testBrand}
				document={menuDocument}
				linkElementProps={resolveLinkElementProps}
				sectionComponent={PreviewSection}
			/>
		);

		expect(resolveLinkElementProps).toHaveBeenCalledWith(
			expect.objectContaining({
				elementType: "menu",
				labels: expect.arrayContaining([
					expect.objectContaining({ content: expect.any(String) }),
					expect.objectContaining({ content: expect.any(String) }),
				]),
			})
		);
		expect(resolveLinkElementProps).toHaveBeenCalledWith(
			expect.objectContaining({
				menuItem: expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({})]) }),
				menuRole: "dropdown-trigger",
			})
		);
		expect(resolveLinkElementProps).not.toHaveBeenCalledWith(
			expect.objectContaining({ menuRole: "dropdown-item" })
		);
		const header = menuDocument.structure.layout.header[0];

		if (!header) {
			throw new Error("Expected a header with dropdown links");
		}

		expect(listSectionLinkElementReferences({ node: header.root })).toEqual(
			expect.arrayContaining([expect.objectContaining({ menuRole: "dropdown-item" })])
		);

		expect(preview).toMatch(/<button[^>]+data-link-pointer=/u);
		expect(preview).toContain('data-website-layout-occupied="brand"');
		expect(preview).toMatch(/data-website-layout-occupied="brand"><a[^>]+href="\/"/u);
		expect(preview).toContain('data-website-layout-occupied="navigation"');
		expect(preview).toContain('data-website-layout-occupied="actions"');
	});

	it("links the header brand to the localized home route", () => {
		const published = renderToStaticMarkup(
			<SiteRenderer basePath='/ar' brand={testBrand} document={menuDocument} locale='ar' />
		);

		expect(published).toMatch(/data-website-layout-occupied="brand"><a[^>]+href="\/ar"/u);
	});

	it("omits home navigation from every rendered header", () => {
		const header = menuDocument.structure.layout.header[0];

		if (!header) {
			throw new Error("Expected a header with home navigation");
		}

		const headerDocument = createWebsiteSectionPreviewDocument({
			document: menuDocument,
			section: header,
			target: { area: "header", index: 0, sectionId: header.id },
		});

		const published = renderToStaticMarkup(
			<SiteRenderer brand={testBrand} document={headerDocument} locale='en' />
		);

		expect(published).not.toMatch(/>Home</u);
		expect(published).toMatch(/data-website-layout-occupied="brand"><a[^>]+href="\/"/u);
	});

	it("omits disclosure controls when the section has no declared repeater", () => {
		const resolveDisclosureItemControls = vi.fn(() => <span>controls</span>);
		const registry = vi.spyOn(sectionRegistry, "get").mockReturnValue(undefined);

		try {
			renderToStaticMarkup(
				<SitePreviewRenderer
					brand={testBrand}
					disclosureItemControls={resolveDisclosureItemControls}
					document={menuDocument}
					sectionComponent={PreviewSection}
				/>
			);
		} finally {
			registry.mockRestore();
		}

		expect(resolveDisclosureItemControls).not.toHaveBeenCalled();
	});
});
