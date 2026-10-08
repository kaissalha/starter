import type { Meta, StoryObj } from "@storybook/react-vite";

import { galleryBentoSection } from "../../sections/gallery/gallery-bento";
import { galleryBentoEditorialSection } from "../../sections/gallery/gallery-bento-editorial";
import { galleryCarouselSection } from "../../sections/gallery/gallery-carousel";
import { galleryCenterStageSection } from "../../sections/gallery/gallery-center-stage";
import { galleryFlatBentoSection } from "../../sections/gallery/gallery-flat-bento";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { galleryMasonrySection } from "../../sections/gallery/gallery-masonry";
import { galleryMosaicSection } from "../../sections/gallery/gallery-mosaic";
import { gallerySlideshowSection } from "../../sections/gallery/gallery-slideshow";
import { gallerySlideshowLabelledSection } from "../../sections/gallery/gallery-slideshow-labelled";
import galleryBentoEditorialSectionFixtures from "../fixtures/sections/gallery/gallery-bento-editorial.json";
import galleryBentoSectionFixtures from "../fixtures/sections/gallery/gallery-bento.json";
import galleryCarouselSectionFixtures from "../fixtures/sections/gallery/gallery-carousel.json";
import galleryCenterStageSectionFixtures from "../fixtures/sections/gallery/gallery-center-stage.json";
import galleryFlatBentoSectionFixtures from "../fixtures/sections/gallery/gallery-flat-bento.json";
import galleryGridSectionFixtures from "../fixtures/sections/gallery/gallery-grid.json";
import galleryMasonrySectionFixtures from "../fixtures/sections/gallery/gallery-masonry.json";
import galleryMosaicSectionFixtures from "../fixtures/sections/gallery/gallery-mosaic.json";
import gallerySlideshowLabelledSectionFixtures from "../fixtures/sections/gallery/gallery-slideshow-labelled.json";
import gallerySlideshowSectionFixtures from "../fixtures/sections/gallery/gallery-slideshow.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Gallery",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GalleryBento: Story = {
	args: { definition: galleryBentoSection, fixtures: galleryBentoSectionFixtures },
};

export const GalleryBentoEditorial: Story = {
	args: { definition: galleryBentoEditorialSection, fixtures: galleryBentoEditorialSectionFixtures },
};

export const GalleryCarousel: Story = {
	args: { definition: galleryCarouselSection, fixtures: galleryCarouselSectionFixtures },
};

export const GalleryCenterStage: Story = {
	args: { definition: galleryCenterStageSection, fixtures: galleryCenterStageSectionFixtures },
};

export const GalleryFlatBento: Story = {
	args: { definition: galleryFlatBentoSection, fixtures: galleryFlatBentoSectionFixtures },
};

export const GalleryGrid: Story = {
	args: { definition: galleryGridSection, fixtures: galleryGridSectionFixtures },
};

export const GalleryMasonry: Story = {
	args: { definition: galleryMasonrySection, fixtures: galleryMasonrySectionFixtures },
};

export const GalleryMosaic: Story = {
	args: { definition: galleryMosaicSection, fixtures: galleryMosaicSectionFixtures },
};

export const GallerySlideshow: Story = {
	args: { definition: gallerySlideshowSection, fixtures: gallerySlideshowSectionFixtures },
};

export const GallerySlideshowLabelled: Story = {
	args: { definition: gallerySlideshowLabelledSection, fixtures: gallerySlideshowLabelledSectionFixtures },
};
