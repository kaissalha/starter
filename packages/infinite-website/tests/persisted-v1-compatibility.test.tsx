import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { parseSiteDocument } from "../src/document/document-validation";
import { editWebsiteSnapshot } from "../src/document/edit-website";
import {
	persistedWebsiteContentSchema,
	persistedWebsiteLogicSchema,
	persistedWebsiteSiteSchema,
	persistedWebsiteStructureSchema,
} from "../src/generation/contracts";
import { SiteRenderer } from "../src/rendering/site-renderer";
import { sectionDefinitions } from "../src/section-registry";
import persistedPatterns from "./fixtures/persisted-patterns-v1.json";
import persistedColumns from "./fixtures/persisted-website-columns-v1.json";

const pageId = "588d886f-5633-5008-af71-7446af04ffec";

const sectionId = "1a92d894-5390-50d9-a0f4-542770adb145";

const readFixture = () => {
	const structure = persistedWebsiteStructureSchema.parse(structuredClone(persistedColumns.structure));
	const content = persistedWebsiteContentSchema.parse(structuredClone(persistedColumns.content));
	const logic = persistedWebsiteLogicSchema.parse(structuredClone(persistedColumns.logic));
	const document = parseSiteDocument({ ...structure, content, logic });

	return persistedWebsiteSiteSchema.parse({
		assetBindings: persistedColumns.assetBindings,
		brand: persistedColumns.brand,
		document,
		schemaVersion: 1,
		templateId: persistedColumns.templateId,
	});
};

describe("persisted website v1 compatibility", () => {
	it("parses, edits, and renders frozen database columns without migration", () => {
		const site = readFixture();
		const originalColumns = structuredClone(persistedColumns);

		const english = renderToStaticMarkup(
			<SiteRenderer assets={site.assetBindings} brand={site.brand} document={site.document} locale='en' />
		);

		const arabic = renderToStaticMarkup(
			<SiteRenderer assets={site.assetBindings} brand={site.brand} document={site.document} locale='ar' />
		);

		expect(english).toContain("Mobile Sauna &amp; Cold Plunge");
		expect(english).toContain("Book your session");
		expect(arabic).toContain("ساونا متنقلة وغطس بارد");
		expect(arabic).toContain('dir="rtl"');

		const edited = editWebsiteSnapshot({
			input: {
				locale: "en",
				operation: "update-text",
				pageId,
				pointer: "/copy/heading",
				sectionId,
				value: "Persisted v1 still edits",
			},
			snapshot: {
				assets: site.assetBindings,
				brand: site.brand,
				document: site.document,
				schemaVersion: 1,
				templateId: site.templateId,
			},
		});

		const reparsed = persistedWebsiteSiteSchema.parse({ ...site, document: parseSiteDocument(edited.document) });

		const editedMarkup = renderToStaticMarkup(
			<SiteRenderer brand={reparsed.brand} document={reparsed.document} locale='en' />
		);

		expect(editedMarkup).toContain("Persisted v1 still edits");
		expect(persistedColumns).toEqual(originalColumns);
	});

	it("keeps every persisted v1 pattern registered", () => {
		expect(persistedPatterns).toEqual(persistedPatterns.toSorted());
		expect(new Set(persistedPatterns).size).toBe(persistedPatterns.length);

		const currentPatterns = sectionDefinitions.map(({ pattern }) => pattern).toSorted();
		expect(currentPatterns).toEqual(expect.arrayContaining(persistedPatterns));
	});
});
