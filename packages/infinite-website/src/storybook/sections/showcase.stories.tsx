import type { Meta, StoryObj } from "@storybook/react-vite";

import { showcaseBentoCardsSection } from "../../sections/showcase/showcase-bento-cards";
import { showcaseCarouselSection } from "../../sections/showcase/showcase-carousel";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { showcaseGridHighlightSection } from "../../sections/showcase/showcase-grid-highlight";
import { showcaseListSection } from "../../sections/showcase/showcase-list";
import { showcaseStripImagesSection } from "../../sections/showcase/showcase-strip-images";
import { showcaseTextCarouselSection } from "../../sections/showcase/showcase-text-carousel";
import showcaseBentoCardsSectionFixtures from "../fixtures/sections/showcase/showcase-bento-cards.json";
import showcaseCarouselSectionFixtures from "../fixtures/sections/showcase/showcase-carousel.json";
import showcaseGridHighlightSectionFixtures from "../fixtures/sections/showcase/showcase-grid-highlight.json";
import showcaseGridSectionFixtures from "../fixtures/sections/showcase/showcase-grid.json";
import showcaseListSectionFixtures from "../fixtures/sections/showcase/showcase-list.json";
import showcaseStripImagesSectionFixtures from "../fixtures/sections/showcase/showcase-strip-images.json";
import showcaseTextCarouselSectionFixtures from "../fixtures/sections/showcase/showcase-text-carousel.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Showcase",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ShowcaseBentoCards: Story = {
	args: { definition: showcaseBentoCardsSection, fixtures: showcaseBentoCardsSectionFixtures },
};

export const ShowcaseGrid: Story = {
	args: { definition: showcaseGridSection, fixtures: showcaseGridSectionFixtures },
};

export const ShowcaseGridHighlight: Story = {
	args: { definition: showcaseGridHighlightSection, fixtures: showcaseGridHighlightSectionFixtures },
};

export const ShowcaseList: Story = {
	args: { definition: showcaseListSection, fixtures: showcaseListSectionFixtures },
};

export const ShowcaseStripImages: Story = {
	args: { definition: showcaseStripImagesSection, fixtures: showcaseStripImagesSectionFixtures },
};

export const ShowcaseCarousel: Story = {
	args: { definition: showcaseCarouselSection, fixtures: showcaseCarouselSectionFixtures },
};

export const ShowcaseTextCarousel: Story = {
	args: { definition: showcaseTextCarouselSection, fixtures: showcaseTextCarouselSectionFixtures },
};
