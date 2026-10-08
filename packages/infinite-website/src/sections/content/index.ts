import type { SectionDefinition } from "../section-definition";
import { blogFeaturedSection } from "./blog-featured";
import { blogFeedSection } from "./blog-feed";
import { blogLatestSixSection, blogLatestThreeSection } from "./blog-latest";
import { blogListSection } from "./blog-list";
import { blogPortraitGridSection } from "./blog-portrait-grid";
import { textBasicSection } from "./text-basic";
import { textScrollRevealSection } from "./text-scroll-reveal";

export const contentSections: Array<SectionDefinition> = [
	textBasicSection,
	textScrollRevealSection,
	blogLatestThreeSection,
	blogLatestSixSection,
	blogFeaturedSection,
	blogFeedSection,
	blogListSection,
	blogPortraitGridSection,
];
