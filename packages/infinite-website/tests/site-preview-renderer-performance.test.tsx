// @vitest-environment happy-dom

import type { ComponentProps } from "react";

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { entityIdSchema, resolveSectionContentReference } from "../src/document/content-schema";
import {
	listSectionContentReferences,
	listSectionTextNodeReferences,
} from "../src/document/section-content-references";
import { SitePreviewRenderer, type SitePreviewSectionProps } from "../src/rendering/site-preview-renderer";
import { entityIdFromSeed } from "../src/sections/entity-id";
import { nordicEdgeTemplate } from "../src/templates/nordic-edge";
import nordicEdgeContent from "../src/templates/nordic-edge/content.json";
import { instantiateTemplate } from "../src/templates/template-definition";
import { testBrand } from "./fixtures/brand";

const previewSectionRender = vi.fn();

const PreviewSection = ({ children, section }: SitePreviewSectionProps) => {
	previewSectionRender(section.id);

	return children;
};

const createDocument = () =>
	instantiateTemplate({
		content: nordicEdgeContent,
		createId: ({ kind, path }) => entityIdFromSeed({ seed: `preview-performance:${kind}:${path}` }),
		definition: nordicEdgeTemplate,
		path: "/preview-performance",
	});

describe("site preview renderer updates", () => {
	it("rerenders only the section whose referenced asset value changed", () => {
		previewSectionRender.mockClear();
		const document = createDocument();
		const page = document.structure.pages[0];

		const target = page?.sections.find(
			(section) =>
				listSectionContentReferences({ kind: "asset", node: section.root }).length > 0 &&
				listSectionTextNodeReferences({ node: section.root }).length > 0
		);

		if (!page || !target) {
			throw new Error("Expected a visible section with text and an asset");
		}

		const reference = listSectionContentReferences({ kind: "asset", node: target.root })[0];

		if (!reference) {
			throw new Error("Expected the target section to reference an asset");
		}

		const assetId = entityIdSchema.parse(
			resolveSectionContentReference({
				content: document.content,
				contentId: target.contentId,
				defaultLocale: document.defaultLocale,
				locale: "en",
				reference,
			})
		);

		const textElementProps = vi.fn(() => undefined);

		const preview = (assets: ComponentProps<typeof SitePreviewRenderer>["assets"]) => (
			<SitePreviewRenderer
				assets={assets}
				brand={testBrand}
				document={document}
				locale='en'
				sectionComponent={PreviewSection}
				textElementProps={textElementProps}
			/>
		);

		const view = render(preview({}));

		const initialCalls = textElementProps.mock.calls.length;
		const initialSectionRenders = previewSectionRender.mock.calls.length;
		const targetTextFields = listSectionTextNodeReferences({ node: target.root }).length;
		const unrelatedAssetId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d399";
		const unrelatedAsset = { src: "/unrelated-image.jpg", type: "image" as const };

		view.rerender(preview({ [unrelatedAssetId]: unrelatedAsset }));

		expect(textElementProps).toHaveBeenCalledTimes(initialCalls);
		expect(previewSectionRender).toHaveBeenCalledTimes(initialSectionRenders);

		view.rerender(
			preview({
				[assetId]: { src: "/updated-image.jpg", type: "image" },
				[unrelatedAssetId]: unrelatedAsset,
			})
		);

		expect(textElementProps).toHaveBeenCalledTimes(initialCalls + targetTextFields);
		expect(previewSectionRender).toHaveBeenCalledTimes(initialSectionRenders + 1);
		expect(previewSectionRender).toHaveBeenLastCalledWith(target.id);

		view.rerender(
			preview({
				[assetId]: { src: "/updated-image.jpg", type: "image" },
				[unrelatedAssetId]: { ...unrelatedAsset },
			})
		);

		expect(textElementProps).toHaveBeenCalledTimes(initialCalls + targetTextFields);
		expect(previewSectionRender).toHaveBeenCalledTimes(initialSectionRenders + 1);

		view.rerender(
			preview({
				[assetId]: {
					height: 675,
					sources: [
						{ src: "/updated-image-small.jpg", width: 480 },
						{ src: "/updated-image.jpg", width: 1200 },
					],
					src: "/updated-image.jpg",
					type: "image",
					width: 1200,
				},
				[unrelatedAssetId]: unrelatedAsset,
			})
		);

		expect(textElementProps).toHaveBeenCalledTimes(initialCalls + targetTextFields * 2);
		expect(previewSectionRender).toHaveBeenCalledTimes(initialSectionRenders + 2);
		expect(previewSectionRender).toHaveBeenLastCalledWith(target.id);
	});
});
