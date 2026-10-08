import type { Meta, StoryObj } from "@storybook/react-vite";

import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { ctaBasicSection } from "../../sections/call-to-action/cta-basic";
import { ctaCardSection } from "../../sections/call-to-action/cta-card";
import { ctaCard2Section } from "../../sections/call-to-action/cta-card-2";
import { ctaEditorialBorderedSection } from "../../sections/call-to-action/cta-editorial-bordered";
import { ctaEditorialImageSection } from "../../sections/call-to-action/cta-editorial-image";
import ctaBackgroundImageSectionFixtures from "../fixtures/sections/call-to-action/cta-background-image.json";
import ctaBasicSectionFixtures from "../fixtures/sections/call-to-action/cta-basic.json";
import ctaCard2SectionFixtures from "../fixtures/sections/call-to-action/cta-card-2.json";
import ctaCardSectionFixtures from "../fixtures/sections/call-to-action/cta-card.json";
import ctaEditorialBorderedSectionFixtures from "../fixtures/sections/call-to-action/cta-editorial-bordered.json";
import ctaEditorialImageSectionFixtures from "../fixtures/sections/call-to-action/cta-editorial-image.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Call To Action",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CtaBackgroundImage: Story = {
	args: { definition: ctaBackgroundImageSection, fixtures: ctaBackgroundImageSectionFixtures },
};

export const CtaBasic: Story = { args: { definition: ctaBasicSection, fixtures: ctaBasicSectionFixtures } };

export const CtaCard: Story = { args: { definition: ctaCardSection, fixtures: ctaCardSectionFixtures } };

export const CtaCard2: Story = { args: { definition: ctaCard2Section, fixtures: ctaCard2SectionFixtures } };

export const CtaEditorialBordered: Story = {
	args: { definition: ctaEditorialBorderedSection, fixtures: ctaEditorialBorderedSectionFixtures },
};

export const CtaEditorialImage: Story = {
	args: { definition: ctaEditorialImageSection, fixtures: ctaEditorialImageSectionFixtures },
};
