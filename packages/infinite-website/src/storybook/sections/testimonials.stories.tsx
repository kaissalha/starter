import type { Meta, StoryObj } from "@storybook/react-vite";

import { testimonialBackgroundCardsSection } from "../../sections/testimonials/testimonial-background-cards";
import { testimonialBorderedGridSection } from "../../sections/testimonials/testimonial-bordered-grid";
import { testimonialCarouselSection } from "../../sections/testimonials/testimonial-carousel";
import { testimonialCarouselCardSection } from "../../sections/testimonials/testimonial-carousel-card";
import { testimonialCenteredCarouselSection } from "../../sections/testimonials/testimonial-centered-carousel";
import { testimonialDoubleSliderSection } from "../../sections/testimonials/testimonial-double-slider";
import { testimonialFullscreenSliderSection } from "../../sections/testimonials/testimonial-fullscreen-slider";
import { testimonialGridSection } from "../../sections/testimonials/testimonial-grid";
import { testimonialParallaxQuoteSection } from "../../sections/testimonials/testimonial-parallax-quote";
import { testimonialSingleCarouselSection } from "../../sections/testimonials/testimonial-single-carousel";
import testimonialBackgroundCardsFixtures from "../fixtures/sections/testimonials/testimonial-background-cards.json";
import testimonialBorderedGridFixtures from "../fixtures/sections/testimonials/testimonial-bordered-grid.json";
import testimonialCarouselCardFixtures from "../fixtures/sections/testimonials/testimonial-carousel-card.json";
import testimonialCarouselFixtures from "../fixtures/sections/testimonials/testimonial-carousel.json";
import testimonialCenteredCarouselFixtures from "../fixtures/sections/testimonials/testimonial-centered-carousel.json";
import testimonialDoubleSliderFixtures from "../fixtures/sections/testimonials/testimonial-double-slider.json";
import testimonialFullscreenSliderFixtures from "../fixtures/sections/testimonials/testimonial-fullscreen-slider.json";
import testimonialGridFixtures from "../fixtures/sections/testimonials/testimonial-grid.json";
import testimonialParallaxQuoteFixtures from "../fixtures/sections/testimonials/testimonial-parallax-quote.json";
import testimonialSingleCarouselFixtures from "../fixtures/sections/testimonials/testimonial-single-carousel.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Testimonials",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TestimonialBackgroundCards: Story = {
	args: { definition: testimonialBackgroundCardsSection, fixtures: testimonialBackgroundCardsFixtures },
};

export const TestimonialBorderedGrid: Story = {
	args: { definition: testimonialBorderedGridSection, fixtures: testimonialBorderedGridFixtures },
};

export const TestimonialCarousel: Story = {
	args: { definition: testimonialCarouselSection, fixtures: testimonialCarouselFixtures },
};

export const TestimonialCarouselCard: Story = {
	args: { definition: testimonialCarouselCardSection, fixtures: testimonialCarouselCardFixtures },
};

export const TestimonialCenteredCarousel: Story = {
	args: { definition: testimonialCenteredCarouselSection, fixtures: testimonialCenteredCarouselFixtures },
};

export const TestimonialDoubleSlider: Story = {
	args: { definition: testimonialDoubleSliderSection, fixtures: testimonialDoubleSliderFixtures },
};

export const TestimonialFullscreenSlider: Story = {
	args: { definition: testimonialFullscreenSliderSection, fixtures: testimonialFullscreenSliderFixtures },
};

export const TestimonialGrid: Story = {
	args: { definition: testimonialGridSection, fixtures: testimonialGridFixtures },
};

export const TestimonialParallaxQuote: Story = {
	args: { definition: testimonialParallaxQuoteSection, fixtures: testimonialParallaxQuoteFixtures },
};

export const TestimonialSingleCarousel: Story = {
	args: { definition: testimonialSingleCarouselSection, fixtures: testimonialSingleCarouselFixtures },
};
