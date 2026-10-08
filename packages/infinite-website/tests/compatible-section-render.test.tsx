import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { websiteGenerationSectionDefinitions, type Iso6391LanguageCode } from "../src/generation";
import { ctaBasicSection } from "../src/sections/call-to-action/cta-basic";
import { contactFormSection } from "../src/sections/contact/contact-form";
import { textBasicSection } from "../src/sections/content/text-basic";
import { faqAccordionSection } from "../src/sections/faq/faq-accordion";
import { featureGridSection } from "../src/sections/features/feature-grid";
import { galleryGridSection } from "../src/sections/gallery/gallery-grid";
import { bannerBasicSection } from "../src/sections/hero/banner-basic";
import ctaBasicFixtures from "../src/storybook/fixtures/sections/call-to-action/cta-basic.json";
import contactFormFixtures from "../src/storybook/fixtures/sections/contact/contact-form.json";
import textBasicFixtures from "../src/storybook/fixtures/sections/content/text-basic.json";
import faqAccordionFixtures from "../src/storybook/fixtures/sections/faq/faq-accordion.json";
import featureGridFixtures from "../src/storybook/fixtures/sections/features/feature-grid.json";
import galleryGridFixtures from "../src/storybook/fixtures/sections/gallery/gallery-grid.json";
import bannerBasicFixtures from "../src/storybook/fixtures/sections/hero/banner-basic.json";
import { SectionStoryPreview } from "../src/storybook/section-story-preview";

const patterns = [
	{
		category: "hero",
		definition: bannerBasicSection,
		fixtures: bannerBasicFixtures,
		markers: { ar: "نصنع حدائق حقيقية", en: "We make real garden" },
	},
	{
		category: "content",
		definition: textBasicSection,
		fixtures: textBasicFixtures,
		markers: { ar: "حوّل مساحتك الخارجية", en: "Transform Your Outdoor Space" },
	},
	{
		category: "features",
		definition: featureGridSection,
		fixtures: featureGridFixtures,
		markers: { ar: "فخار مصنوع يدويًا", en: "Handmade pottery" },
	},
	{
		category: "gallery",
		definition: galleryGridSection,
		fixtures: galleryGridFixtures,
		markers: { ar: "أعمالنا", en: "Our work" },
	},
	{
		category: "faq",
		definition: faqAccordionSection,
		fixtures: faqAccordionFixtures,
		markers: { ar: "الأسئلة الأكثر شيوعًا", en: "Frequently asked questions" },
	},
	{
		category: "call-to-action",
		definition: ctaBasicSection,
		fixtures: ctaBasicFixtures,
		markers: { ar: "احصل على الحديقة", en: "Get the Yard You Want Today!" },
	},
	{
		category: "contact",
		definition: contactFormSection,
		fixtures: contactFormFixtures,
		markers: { ar: "لنتحدث", en: "Let’s talk" },
	},
] as const;

const locales = ["en", "ar"] satisfies Array<Iso6391LanguageCode>;

const viewports = [
	{ name: "mobile", width: 390 },
	{ name: "tablet", width: 768 },
	{ name: "desktop", width: 1440 },
] as const;

describe("globally compatible section rendering", () => {
	it("renders representative English and Arabic sections responsively across container widths", () => {
		const compatiblePatterns = new Set(websiteGenerationSectionDefinitions.map(({ pattern }) => pattern));

		for (const { definition, fixtures, markers } of patterns) {
			expect(compatiblePatterns.has(definition.pattern)).toBe(true);

			for (const locale of locales) {
				for (const viewport of viewports) {
					const html = renderToStaticMarkup(
						<div
							data-render-viewport={viewport.name}
							style={{ containerType: "inline-size", inlineSize: `${viewport.width}px` }}
						>
							<SectionStoryPreview definition={definition} fixtures={fixtures} locale={locale} />
						</div>
					);

					expect(html).toContain(`data-render-viewport="${viewport.name}"`);
					expect(html).toContain(`inline-size:${viewport.width}px`);
					expect(html).toContain(`lang="${locale}"`);
					expect(html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
					expect(html).toContain(markers[locale]);

					const responsiveMarkers =
						definition.pattern === "contact-form"
							? [/@3xl:grid-cols-2/u]
							: [/--iw-[^:]+-base:/u, /--iw-[^:]+-compact:/u, /--iw-[^:]+-wide:/u];

					responsiveMarkers.forEach((marker) => expect(html).toMatch(marker));
				}
			}
		}
	});
});
