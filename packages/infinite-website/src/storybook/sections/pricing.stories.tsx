import type { Meta, StoryObj } from "@storybook/react-vite";

import { pricingEditorialBorderedSection } from "../../sections/pricing/pricing-editorial-bordered";
import { pricingEditorialHighlightSection } from "../../sections/pricing/pricing-editorial-highlight";
import { pricingTableSection } from "../../sections/pricing/pricing-table";
import { pricingTable2Section } from "../../sections/pricing/pricing-table-2";
import { pricingTable3Section } from "../../sections/pricing/pricing-table-3";
import pricingEditorialBorderedSectionFixtures from "../fixtures/sections/pricing/pricing-editorial-bordered.json";
import pricingEditorialHighlightSectionFixtures from "../fixtures/sections/pricing/pricing-editorial-highlight.json";
import pricingTable2SectionFixtures from "../fixtures/sections/pricing/pricing-table-2.json";
import pricingTable3SectionFixtures from "../fixtures/sections/pricing/pricing-table-3.json";
import pricingTableSectionFixtures from "../fixtures/sections/pricing/pricing-table.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Pricing",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PricingEditorialBordered: Story = {
	args: { definition: pricingEditorialBorderedSection, fixtures: pricingEditorialBorderedSectionFixtures },
};

export const PricingEditorialHighlight: Story = {
	args: { definition: pricingEditorialHighlightSection, fixtures: pricingEditorialHighlightSectionFixtures },
};

export const PricingTable: Story = { args: { definition: pricingTableSection, fixtures: pricingTableSectionFixtures } };

export const PricingTable2: Story = {
	args: { definition: pricingTable2Section, fixtures: pricingTable2SectionFixtures },
};

export const PricingTable3: Story = {
	args: { definition: pricingTable3Section, fixtures: pricingTable3SectionFixtures },
};
