import type { Meta, StoryObj } from "@storybook/react-vite";

import { bannerBackgroundCornerImageSection } from "../../sections/hero/banner-background-corner-image";
import { bannerBasicSection } from "../../sections/hero/banner-basic";
import { bannerBentoGridSection } from "../../sections/hero/banner-bento-grid";
import { bannerBottomCardSection } from "../../sections/hero/banner-bottom-card";
import { bannerCardSection } from "../../sections/hero/banner-card";
import { bannerCardAndBackgroundImageSection } from "../../sections/hero/banner-card-and-background-image";
import { bannerCompactBackgroundSection } from "../../sections/hero/banner-compact-background";
import { bannerDiagonalGridSection } from "../../sections/hero/banner-diagonal-grid";
import { bannerDoubleCarouselSection } from "../../sections/hero/banner-double-carousel";
import { bannerDoubleImageBottomSection } from "../../sections/hero/banner-double-image-bottom";
import { bannerEditorialSplitSection } from "../../sections/hero/banner-editorial-split";
import { bannerFullImageSection } from "../../sections/hero/banner-full-image";
import { bannerGridSection } from "../../sections/hero/banner-grid";
import { bannerImageFullSplitSection } from "../../sections/hero/banner-image-full-split";
import { bannerOrbitSection } from "../../sections/hero/banner-orbit";
import { bannerOversizedParallaxSection } from "../../sections/hero/banner-oversized-parallax";
import { bannerSplitCardSection } from "../../sections/hero/banner-split-card";
import { bannerTextAndBackgroundImageSection } from "../../sections/hero/banner-text-and-background-image";
import { bannerTextAndImageSection } from "../../sections/hero/banner-text-and-image";
import { bannerTextOnlySection } from "../../sections/hero/banner-text-only";
import bannerBackgroundCornerImageSectionFixtures from "../fixtures/sections/hero/banner-background-corner-image.json";
import bannerBasicSectionFixtures from "../fixtures/sections/hero/banner-basic.json";
import bannerBentoGridSectionFixtures from "../fixtures/sections/hero/banner-bento-grid.json";
import bannerBottomCardSectionFixtures from "../fixtures/sections/hero/banner-bottom-card.json";
import bannerCardAndBackgroundImageSectionFixtures from "../fixtures/sections/hero/banner-card-and-background-image.json";
import bannerCardSectionFixtures from "../fixtures/sections/hero/banner-card.json";
import bannerCompactBackgroundSectionFixtures from "../fixtures/sections/hero/banner-compact-background.json";
import bannerDiagonalGridSectionFixtures from "../fixtures/sections/hero/banner-diagonal-grid.json";
import bannerDoubleCarouselSectionFixtures from "../fixtures/sections/hero/banner-double-carousel.json";
import bannerDoubleImageBottomSectionFixtures from "../fixtures/sections/hero/banner-double-image-bottom.json";
import bannerEditorialSplitSectionFixtures from "../fixtures/sections/hero/banner-editorial-split.json";
import bannerFullImageSectionFixtures from "../fixtures/sections/hero/banner-full-image.json";
import bannerGridSectionFixtures from "../fixtures/sections/hero/banner-grid.json";
import bannerImageFullSplitSectionFixtures from "../fixtures/sections/hero/banner-image-full-split.json";
import bannerOrbitSectionFixtures from "../fixtures/sections/hero/banner-orbit.json";
import bannerOversizedParallaxSectionFixtures from "../fixtures/sections/hero/banner-oversized-parallax.json";
import bannerSplitCardSectionFixtures from "../fixtures/sections/hero/banner-split-card.json";
import bannerTextAndBackgroundImageSectionFixtures from "../fixtures/sections/hero/banner-text-and-background-image.json";
import bannerTextAndImageSectionFixtures from "../fixtures/sections/hero/banner-text-and-image.json";
import bannerTextOnlySectionFixtures from "../fixtures/sections/hero/banner-text-only.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Hero",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BannerTextOnly: Story = {
	args: { definition: bannerTextOnlySection, fixtures: bannerTextOnlySectionFixtures },
};

export const BannerBasic: Story = {
	args: { definition: bannerBasicSection, fixtures: bannerBasicSectionFixtures },
};

export const BannerBentoGrid: Story = {
	args: { definition: bannerBentoGridSection, fixtures: bannerBentoGridSectionFixtures },
};

export const BannerCard: Story = {
	args: { definition: bannerCardSection, fixtures: bannerCardSectionFixtures },
};

export const BannerCardAndBackgroundImage: Story = {
	args: { definition: bannerCardAndBackgroundImageSection, fixtures: bannerCardAndBackgroundImageSectionFixtures },
};

export const BannerEditorialSplit: Story = {
	args: { definition: bannerEditorialSplitSection, fixtures: bannerEditorialSplitSectionFixtures },
};

export const BannerCompactBackground: Story = {
	args: { definition: bannerCompactBackgroundSection, fixtures: bannerCompactBackgroundSectionFixtures },
};

export const BannerFullImage: Story = {
	args: { definition: bannerFullImageSection, fixtures: bannerFullImageSectionFixtures },
};

export const BannerDiagonalGrid: Story = {
	args: { definition: bannerDiagonalGridSection, fixtures: bannerDiagonalGridSectionFixtures },
};

export const BannerGrid: Story = { args: { definition: bannerGridSection, fixtures: bannerGridSectionFixtures } };

export const BannerDoubleImageBottom: Story = {
	args: { definition: bannerDoubleImageBottomSection, fixtures: bannerDoubleImageBottomSectionFixtures },
};

export const BannerBottomCard: Story = {
	args: { definition: bannerBottomCardSection, fixtures: bannerBottomCardSectionFixtures },
};

export const BannerImageFullSplit: Story = {
	args: { definition: bannerImageFullSplitSection, fixtures: bannerImageFullSplitSectionFixtures },
};

export const BannerBackgroundCornerImage: Story = {
	args: { definition: bannerBackgroundCornerImageSection, fixtures: bannerBackgroundCornerImageSectionFixtures },
};

export const BannerDoubleCarousel: Story = {
	args: { definition: bannerDoubleCarouselSection, fixtures: bannerDoubleCarouselSectionFixtures },
};

export const BannerOrbit: Story = { args: { definition: bannerOrbitSection, fixtures: bannerOrbitSectionFixtures } };

export const BannerOversizedParallax: Story = {
	args: { definition: bannerOversizedParallaxSection, fixtures: bannerOversizedParallaxSectionFixtures },
};

export const BannerSplitCard: Story = {
	args: { definition: bannerSplitCardSection, fixtures: bannerSplitCardSectionFixtures },
};

export const BannerTextAndBackgroundImage: Story = {
	args: { definition: bannerTextAndBackgroundImageSection, fixtures: bannerTextAndBackgroundImageSectionFixtures },
};

export const BannerTextAndImage: Story = {
	args: { definition: bannerTextAndImageSection, fixtures: bannerTextAndImageSectionFixtures },
};
