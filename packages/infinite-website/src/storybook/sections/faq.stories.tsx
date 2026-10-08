import type { Meta, StoryObj } from "@storybook/react-vite";

import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { faqAccordionImageSection } from "../../sections/faq/faq-accordion-image";
import { faqAccordionMergedSection } from "../../sections/faq/faq-accordion-merged";
import { faqCardSection } from "../../sections/faq/faq-card";
import { faqEditorialBorderedSection } from "../../sections/faq/faq-editorial-bordered";
import { faqEditorialSplitSection } from "../../sections/faq/faq-editorial-split";
import { faqNumberedAccordionSection } from "../../sections/faq/faq-numbered-accordion";
import { faqStretchSection } from "../../sections/faq/faq-stretch";
import faqAccordionImageSectionFixtures from "../fixtures/sections/faq/faq-accordion-image.json";
import faqAccordionMergedSectionFixtures from "../fixtures/sections/faq/faq-accordion-merged.json";
import faqAccordionSectionFixtures from "../fixtures/sections/faq/faq-accordion.json";
import faqCardSectionFixtures from "../fixtures/sections/faq/faq-card.json";
import faqEditorialBorderedSectionFixtures from "../fixtures/sections/faq/faq-editorial-bordered.json";
import faqEditorialSplitSectionFixtures from "../fixtures/sections/faq/faq-editorial-split.json";
import faqNumberedAccordionSectionFixtures from "../fixtures/sections/faq/faq-numbered-accordion.json";
import faqStretchSectionFixtures from "../fixtures/sections/faq/faq-stretch.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/FAQ",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FaqCard: Story = { args: { definition: faqCardSection, fixtures: faqCardSectionFixtures } };

export const FaqStretch: Story = { args: { definition: faqStretchSection, fixtures: faqStretchSectionFixtures } };

export const FaqAccordion: Story = { args: { definition: faqAccordionSection, fixtures: faqAccordionSectionFixtures } };

export const FaqAccordionImage: Story = {
	args: { definition: faqAccordionImageSection, fixtures: faqAccordionImageSectionFixtures },
};

export const FaqAccordionMerged: Story = {
	args: { definition: faqAccordionMergedSection, fixtures: faqAccordionMergedSectionFixtures },
};

export const FaqEditorialBordered: Story = {
	args: { definition: faqEditorialBorderedSection, fixtures: faqEditorialBorderedSectionFixtures },
};

export const FaqEditorialSplit: Story = {
	args: { definition: faqEditorialSplitSection, fixtures: faqEditorialSplitSectionFixtures },
};

export const FaqNumberedAccordion: Story = {
	args: { definition: faqNumberedAccordionSection, fixtures: faqNumberedAccordionSectionFixtures },
};
