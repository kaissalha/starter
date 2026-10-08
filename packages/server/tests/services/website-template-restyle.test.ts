import { describe, expect, it } from "vitest";

import { editWebsiteSnapshot } from "@starter/infinite-website/editing";
import {
	createGenerationTemplateBrand,
	websiteGenerationProfiles,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";
import { templatePreviews } from "@starter/infinite-website/template-previews";

import { prepareWebsiteTemplateRestyle } from "../../src/services/websites/template-restyle";

const createSnapshot = (templateId: string): WebsiteSnapshotV1 => {
	const original = templatePreviews.find(({ id }) => id === templateId)!;

	return {
		assets: original.assets,
		brand: createGenerationTemplateBrand({
			locale: "en",
			profile: websiteGenerationProfiles.find((profile) => profile.templateId === templateId)!,
		}),
		document: original.document,
		schemaVersion: 1,
		templateId,
	};
};

const snapshot = createSnapshot("airy-spacious");

describe("content-preserving template restyle", () => {
	it.each(websiteGenerationProfiles.slice(0, 1))(
		"preserves every content value and asset when applying $templateId",
		({ templateId }) => {
			const result = prepareWebsiteTemplateRestyle({ snapshot, templateId });
			expect(result).not.toBeNull();
			expect(result?.snapshot.document.content).toEqual(snapshot.document.content);
			expect(result?.snapshot.assets).toEqual(snapshot.assets);
			expect(result?.snapshot.document.logic).toEqual(snapshot.document.logic);
			expect(result?.snapshot.document.structure.layout).toEqual(snapshot.document.structure.layout);
			expect(
				result?.snapshot.document.structure.pages.map(({ id, sections }) => [
					id,
					sections.map((section) => section.id),
				])
			).toEqual(
				snapshot.document.structure.pages.map(({ id, sections }) => [id, sections.map((section) => section.id)])
			);
			expect(result?.snapshot.templateId).toBe(templateId);
			expect(result?.inputs[0]?.operation).toBe("update-brand");
		}
	);

	it("changes a compatible layout while preserving its bilingual content and stable identity", () => {
		const before = createSnapshot("alpina-ventures");
		const result = prepareWebsiteTemplateRestyle({ snapshot: before, templateId: "paw-voyage" });
		expect(result?.inputs.filter(({ operation }) => operation === "swap-layout")).toHaveLength(2);
		expect(result?.snapshot).toMatchObject({
			assets: before.assets,
			document: { content: before.document.content },
		});
		expect(
			result?.snapshot.document.structure.pages.map((page) =>
				page.sections.map(({ contentId, id }) => ({ contentId, id }))
			)
		).toEqual(
			before.document.structure.pages.map((page) => page.sections.map(({ contentId, id }) => ({ contentId, id })))
		);
	});

	it("retains a customized section when catalog layout compatibility no longer matches its actual fields", () => {
		const page = snapshot.document.structure.pages[0]!;
		const section = page.sections[0]!;

		const customized = editWebsiteSnapshot({
			input: {
				operation: "replace-section-root",
				pageId: page.id,
				root: { ...section.root, props: { ...section.root.props, children: [] } },
				sectionId: section.id,
			},
			snapshot,
		});

		const restyled = prepareWebsiteTemplateRestyle({ snapshot: customized, templateId: "steady-ascent" });
		expect(restyled?.snapshot.document.structure.pages[0]?.sections[0]).toEqual(
			customized.document.structure.pages[0]?.sections[0]
		);
		expect(restyled?.snapshot.document.content).toEqual(customized.document.content);
	});

	it("rejects templates outside the reviewed catalog", () => {
		expect(prepareWebsiteTemplateRestyle({ snapshot, templateId: "unlisted" })).toBeNull();
	});
});
