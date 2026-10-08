import type { Meta, StoryObj } from "@storybook/react-vite";

import { footerContactSplitSection } from "../../sections/footer/footer-contact-split";
import { footerDetachedSection } from "../../sections/footer/footer-detached";
import { footerEditorialSplitSection } from "../../sections/footer/footer-editorial-split";
import { footerInfoGridSection } from "../../sections/footer/footer-info-grid";
import { footerLogoHighlightSection } from "../../sections/footer/footer-logo-highlight";
import { footerLogoNavSection } from "../../sections/footer/footer-logo-nav";
import { footerPillNavSection } from "../../sections/footer/footer-pill-nav";
import { footerSplitImageSection } from "../../sections/footer/footer-split-image";
import footerContactSplitSectionFixtures from "../fixtures/sections/footer/footer-contact-split.json";
import footerDetachedSectionFixtures from "../fixtures/sections/footer/footer-detached.json";
import footerEditorialSplitSectionFixtures from "../fixtures/sections/footer/footer-editorial-split.json";
import footerInfoGridSectionFixtures from "../fixtures/sections/footer/footer-info-grid.json";
import footerLogoHighlightSectionFixtures from "../fixtures/sections/footer/footer-logo-highlight.json";
import footerLogoNavSectionFixtures from "../fixtures/sections/footer/footer-logo-nav.json";
import footerPillNavSectionFixtures from "../fixtures/sections/footer/footer-pill-nav.json";
import footerSplitImageSectionFixtures from "../fixtures/sections/footer/footer-split-image.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Footer",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FooterContactSplit: Story = {
	args: { definition: footerContactSplitSection, fixtures: footerContactSplitSectionFixtures },
};

export const FooterLogoNav: Story = {
	args: { definition: footerLogoNavSection, fixtures: footerLogoNavSectionFixtures },
};

export const FooterLogoHighlight: Story = {
	args: { definition: footerLogoHighlightSection, fixtures: footerLogoHighlightSectionFixtures },
};

export const FooterInfoGrid: Story = {
	args: { definition: footerInfoGridSection, fixtures: footerInfoGridSectionFixtures },
};

export const FooterPillNav: Story = {
	args: { definition: footerPillNavSection, fixtures: footerPillNavSectionFixtures },
};

export const FooterDetached: Story = {
	args: { definition: footerDetachedSection, fixtures: footerDetachedSectionFixtures },
};

export const FooterEditorialSplit: Story = {
	args: { definition: footerEditorialSplitSection, fixtures: footerEditorialSplitSectionFixtures },
};

export const FooterSplitImage: Story = {
	args: { definition: footerSplitImageSection, fixtures: footerSplitImageSectionFixtures },
};
