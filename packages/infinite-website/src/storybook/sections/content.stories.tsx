import type { Meta, StoryObj } from "@storybook/react-vite";

import { blogFeaturedSection } from "../../sections/content/blog-featured";
import { blogFeedSection } from "../../sections/content/blog-feed";
import { blogLatestSixSection, blogLatestThreeSection } from "../../sections/content/blog-latest";
import { blogListSection } from "../../sections/content/blog-list";
import { blogPortraitGridSection } from "../../sections/content/blog-portrait-grid";
import { textBasicSection } from "../../sections/content/text-basic";
import { textScrollRevealSection } from "../../sections/content/text-scroll-reveal";
import { sampleBlogPosts } from "../fixtures/blog-posts";
import blogFeaturedSectionFixtures from "../fixtures/sections/content/blog-featured.json";
import blogFeedSectionFixtures from "../fixtures/sections/content/blog-feed.json";
import blogFixtures from "../fixtures/sections/content/blog-latest-three.json";
import blogListSectionFixtures from "../fixtures/sections/content/blog-list.json";
import blogPortraitGridSectionFixtures from "../fixtures/sections/content/blog-portrait-grid.json";
import textBasicSectionFixtures from "../fixtures/sections/content/text-basic.json";
import textScrollRevealSectionFixtures from "../fixtures/sections/content/text-scroll-reveal.json";
import { SectionStoryPreview } from "../section-story-preview";

const meta = {
	component: SectionStoryPreview,
	parameters: { controls: { disable: true }, layout: "fullscreen" },
	title: "Sections/Content",
} satisfies Meta<typeof SectionStoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TextBasic: Story = { args: { definition: textBasicSection, fixtures: textBasicSectionFixtures } };

export const TextScrollReveal: Story = {
	args: { definition: textScrollRevealSection, fixtures: textScrollRevealSectionFixtures },
};

export const BlogLatestThree: Story = { args: { definition: blogLatestThreeSection, fixtures: blogFixtures } };

export const BlogLatestSix: Story = { args: { definition: blogLatestSixSection, fixtures: blogFixtures } };

export const BlogFeatured: Story = {
	args: { blogPosts: sampleBlogPosts, definition: blogFeaturedSection, fixtures: blogFeaturedSectionFixtures },
};

export const BlogFeed: Story = {
	args: { blogPosts: sampleBlogPosts, definition: blogFeedSection, fixtures: blogFeedSectionFixtures },
};

export const BlogList: Story = {
	args: { blogPosts: sampleBlogPosts, definition: blogListSection, fixtures: blogListSectionFixtures },
};

export const BlogPortraitGrid: Story = {
	args: {
		blogPosts: sampleBlogPosts,
		definition: blogPortraitGridSection,
		fixtures: blogPortraitGridSectionFixtures,
	},
};
