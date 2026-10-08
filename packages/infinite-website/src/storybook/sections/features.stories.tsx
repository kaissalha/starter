import type { Meta, StoryObj } from "@storybook/react-vite";

import { featureBentoGridSection } from "../../sections/features/feature-bento-grid";
import { featureBoxGridSection } from "../../sections/features/feature-box-grid";
import { featureCardCarouselSection } from "../../sections/features/feature-card-carousel";
import { featureCarouselSection } from "../../sections/features/feature-carousel";
import { featureCarouselAccordionSection } from "../../sections/features/feature-carousel-accordion";
import { featureCarouselSplitSection } from "../../sections/features/feature-carousel-split";
import { featureCenteredCarouselSection } from "../../sections/features/feature-centered-carousel";
import { featureExpandableCarouselSection } from "../../sections/features/feature-expandable-carousel";
import { featureGridSection } from "../../sections/features/feature-grid";
import { featureGridWithImageSection } from "../../sections/features/feature-grid-with-image";
import { featureIconsSection } from "../../sections/features/feature-icons";
import { featureImagesCarouselSection } from "../../sections/features/feature-images-carousel";
import { featureListBackgroundImageSection } from "../../sections/features/feature-list-background-image";
import { featureMenuGridSection } from "../../sections/features/feature-menu-grid";
import { featureMenuListSection } from "../../sections/features/feature-menu-list";
import { featureMenuListTextSection } from "../../sections/features/feature-menu-list-text";
import { featureMiniImageCardsSection } from "../../sections/features/feature-mini-image-cards";
import { featurePortraitCarouselSection } from "../../sections/features/feature-portrait-carousel";
import { featureProgressAccordionSection } from "../../sections/features/feature-progress-accordion";
import { featureStickyImageSection } from "../../sections/features/feature-sticky-image";
import { featureStripScrollSection } from "../../sections/features/feature-strip-scroll";
import { featureTextStackedSection } from "../../sections/features/feature-text-stacked";
import { featureThreeCardSection } from "../../sections/features/feature-three-card";
import { featureVideoSection } from "../../sections/features/feature-video";
import featureBentoGridSectionFixtures from "../fixtures/sections/features/feature-bento-grid.json";
import featureBoxGridSectionFixtures from "../fixtures/sections/features/feature-box-grid.json";
import featureCardCarouselSectionFixtures from "../fixtures/sections/features/feature-card-carousel.json";
import featureCarouselAccordionSectionFixtures from "../fixtures/sections/features/feature-carousel-accordion.json";
import featureCarouselSplitSectionFixtures from "../fixtures/sections/features/feature-carousel-split.json";
import featureCarouselSectionFixtures from "../fixtures/sections/features/feature-carousel.json";
import featureCenteredCarouselSectionFixtures from "../fixtures/sections/features/feature-centered-carousel.json";
import featureExpandableCarouselSectionFixtures from "../fixtures/sections/features/feature-expandable-carousel.json";
import featureGridWithImageSectionFixtures from "../fixtures/sections/features/feature-grid-with-image.json";
import featureGridSectionFixtures from "../fixtures/sections/features/feature-grid.json";
import featureIconsSectionFixtures from "../fixtures/sections/features/feature-icons.json";
import featureImagesCarouselSectionFixtures from "../fixtures/sections/features/feature-images-carousel.json";
import featureListBackgroundImageSectionFixtures from "../fixtures/sections/features/feature-list-background-image.json";
import featureMenuGridSectionFixtures from "../fixtures/sections/features/feature-menu-grid.json";
import featureMenuListTextSectionFixtures from "../fixtures/sections/features/feature-menu-list-text.json";
import featureMenuListSectionFixtures from "../fixtures/sections/features/feature-menu-list.json";
import featureMiniImageCardsSectionFixtures from "../fixtures/sections/features/feature-mini-image-cards.json";
import featurePortraitCarouselSectionFixtures from "../fixtures/sections/features/feature-portrait-carousel.json";
import featureProgressAccordionSectionFixtures from "../fixtures/sections/features/feature-progress-accordion.json";
import featureStickyImageSectionFixtures from "../fixtures/sections/features/feature-sticky-image.json";
import featureStripScrollSectionFixtures from "../fixtures/sections/features/feature-strip-scroll.json";
import featureTextStackedSectionFixtures from "../fixtures/sections/features/feature-text-stacked.json";
import featureThreeCardSectionFixtures from "../fixtures/sections/features/feature-three-card.json";
import featureVideoSectionFixtures from "../fixtures/sections/features/feature-video.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Features",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FeatureBentoGrid: Story = {
	args: { definition: featureBentoGridSection, fixtures: featureBentoGridSectionFixtures },
};

export const FeatureCarousel: Story = {
	args: { definition: featureCarouselSection, fixtures: featureCarouselSectionFixtures },
};

export const FeatureGrid: Story = { args: { definition: featureGridSection, fixtures: featureGridSectionFixtures } };

export const FeatureStickyImage: Story = {
	args: { definition: featureStickyImageSection, fixtures: featureStickyImageSectionFixtures },
};

export const FeatureMenuGrid: Story = {
	args: { definition: featureMenuGridSection, fixtures: featureMenuGridSectionFixtures },
};

export const FeatureMenuList: Story = {
	args: { definition: featureMenuListSection, fixtures: featureMenuListSectionFixtures },
};

export const FeatureMenuListText: Story = {
	args: { definition: featureMenuListTextSection, fixtures: featureMenuListTextSectionFixtures },
};

export const FeatureListBackgroundImage: Story = {
	args: { definition: featureListBackgroundImageSection, fixtures: featureListBackgroundImageSectionFixtures },
};

export const FeatureBoxGrid: Story = {
	args: { definition: featureBoxGridSection, fixtures: featureBoxGridSectionFixtures },
};

export const FeatureGridWithImage: Story = {
	args: { definition: featureGridWithImageSection, fixtures: featureGridWithImageSectionFixtures },
};

export const FeatureIcons: Story = {
	args: { definition: featureIconsSection, fixtures: featureIconsSectionFixtures },
};

export const FeatureCardCarousel: Story = {
	args: { definition: featureCardCarouselSection, fixtures: featureCardCarouselSectionFixtures },
};

export const FeatureCenteredCarousel: Story = {
	args: { definition: featureCenteredCarouselSection, fixtures: featureCenteredCarouselSectionFixtures },
};

export const FeatureImagesCarousel: Story = {
	args: { definition: featureImagesCarouselSection, fixtures: featureImagesCarouselSectionFixtures },
};

export const FeatureTextStacked: Story = {
	args: { definition: featureTextStackedSection, fixtures: featureTextStackedSectionFixtures },
};

export const FeatureThreeCard: Story = {
	args: { definition: featureThreeCardSection, fixtures: featureThreeCardSectionFixtures },
};

export const FeatureMiniImageCards: Story = {
	args: { definition: featureMiniImageCardsSection, fixtures: featureMiniImageCardsSectionFixtures },
};

export const FeaturePortraitCarousel: Story = {
	args: { definition: featurePortraitCarouselSection, fixtures: featurePortraitCarouselSectionFixtures },
};

export const FeatureVideo: Story = { args: { definition: featureVideoSection, fixtures: featureVideoSectionFixtures } };

export const FeatureStripScroll: Story = {
	args: { definition: featureStripScrollSection, fixtures: featureStripScrollSectionFixtures },
};

export const FeatureProgressAccordion: Story = {
	args: { definition: featureProgressAccordionSection, fixtures: featureProgressAccordionSectionFixtures },
};

export const FeatureCarouselAccordion: Story = {
	args: { definition: featureCarouselAccordionSection, fixtures: featureCarouselAccordionSectionFixtures },
};

export const FeatureCarouselSplit: Story = {
	args: { definition: featureCarouselSplitSection, fixtures: featureCarouselSplitSectionFixtures },
};

export const FeatureExpandableCarousel: Story = {
	args: { definition: featureExpandableCarouselSection, fixtures: featureExpandableCarouselSectionFixtures },
};
