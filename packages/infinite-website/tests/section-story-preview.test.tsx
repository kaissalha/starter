import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { bannerBasicSection } from "../src/sections/hero/banner-basic";
import { pricingTableSection } from "../src/sections/pricing/pricing-table";
import bannerBasicFixtures from "../src/storybook/fixtures/sections/hero/banner-basic.json";
import pricingTableFixtures from "../src/storybook/fixtures/sections/pricing/pricing-table.json";
import { SectionStoryPreview } from "../src/storybook/section-story-preview";

describe("section story preview", () => {
	it("promotes a featured service plan on small containers", () => {
		const html = renderToStaticMarkup(
			<SectionStoryPreview definition={pricingTableSection} fixtures={pricingTableFixtures} />
		);

		expect(html).toMatch(/--iw-order-base:\s*-1/u);
		expect(html).toMatch(/--iw-order-wide:\s*0/u);
	});

	it("supplies invisible targets for anchors referenced outside an isolated section", () => {
		const html = renderToStaticMarkup(
			<SectionStoryPreview definition={bannerBasicSection} fixtures={bannerBasicFixtures} />
		);

		expect(html).toContain('href="#');
		expect(html).toContain("--iw-display-base:none");
	});
});
