import { beforeEach, expect, it, vi } from "vitest";

import { defaultLinkPageSectionAppearance } from "@starter/infinite-links/contracts";
import { createDefaultLinkPageDocument } from "@starter/infinite-links/document";
import { createEmptyBlogPostDocument } from "@starter/infinite-website/contracts";
import { createGenerationTemplateBrand, websiteGenerationProfiles } from "@starter/infinite-website/generation";
import { templatePreviews } from "@starter/infinite-website/template-previews";

import { translateBlogDocument } from "../../src/services/blog-posts/translation";
import { translateLinkPageDocument } from "../../src/services/link-page-translation";
import { prepareWebsiteLanguage } from "../../src/services/websites/languages";

const { translate } = vi.hoisted(() => ({ translate: vi.fn() }));

vi.mock("../../src/services/content-translation", () => ({ translateContentFields: translate }));

beforeEach(() => {
	translate
		.mockReset()
		.mockImplementation(async ({ fields }: { fields: Array<string> }) =>
			fields.map((field) => (field ? `FR ${field}` : ""))
		);
});

it("translates website text and metadata while preserving routes, structure, and existing languages", async () => {
	const template = templatePreviews[0]!;

	const snapshot = {
		...template,
		brand: createGenerationTemplateBrand({ locale: "en", profile: websiteGenerationProfiles[0]! }),
	};

	const result = await prepareWebsiteLanguage({ input: { locale: "fr", operation: "add-language" }, snapshot });
	expect(result.content?.site.name).toBe(`FR ${snapshot.document.content.en?.site.name}`);

	for (const [id, page] of Object.entries(snapshot.document.content.en!.pages)) {
		expect(result.content?.pages[id]?.route).toEqual(page.route);
	}

	expect(snapshot.document.locales).not.toContain("fr");
});

it("translates Links copy without replacing existing translations or destinations", async () => {
	const document = createDefaultLinkPageDocument({ name: "Studio" });
	document.profile.title.fr = "Atelier";
	document.blocks = [
		{
			appearance: defaultLinkPageSectionAppearance,
			enabled: true,
			id: crypto.randomUUID(),
			kind: "link",
			label: { en: "Visit" },
			layout: "classic",
			url: "https://example.com",
		},
	];
	const result = await translateLinkPageDocument({ document, locale: "fr", sourceLocale: "en" });
	expect(result.profile.title.fr).toBe("Atelier");
	expect(result.blocks[0]).toMatchObject({
		id: document.blocks[0]!.id,
		label: { en: "Visit", fr: "FR Visit" },
		url: "https://example.com",
	});
});

it("preserves rich Blog structure and links when translating", async () => {
	const document = createEmptyBlogPostDocument();
	document.en.title = "Hello";
	document.en.body.content = [
		{
			attrs: { level: 2 },
			content: [
				{ marks: [{ attrs: { href: "https://example.com" }, type: "link" }], text: "Read", type: "text" },
			],
			type: "heading",
		},
		{ attrs: { alt: "Image", src: "https://example.com/image.jpg" }, type: "image" },
	];
	const result = await translateBlogDocument({ document, locale: "fr" });
	expect(result.en).toEqual(document.en);
	expect(result.translations?.fr?.title).toBe("FR Hello");
	expect(result.translations?.fr?.body.content).toEqual([
		{
			...document.en.body.content[0],
			content: [
				{ marks: [{ attrs: { href: "https://example.com" }, type: "link" }], text: "FR Read", type: "text" },
			],
		},
		{ attrs: { alt: "FR Image", src: "https://example.com/image.jpg" }, type: "image" },
	]);
});
