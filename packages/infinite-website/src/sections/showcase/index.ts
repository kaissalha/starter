import type { SectionDefinition } from "../section-definition";
import { showcaseBentoCardsSection } from "./showcase-bento-cards";
import { showcaseCarouselSection } from "./showcase-carousel";
import { showcaseGridSection } from "./showcase-grid";
import { showcaseGridHighlightSection } from "./showcase-grid-highlight";
import { showcaseListSection } from "./showcase-list";
import { showcaseStripImagesSection } from "./showcase-strip-images";
import { showcaseTextCarouselSection } from "./showcase-text-carousel";

export const showcaseSections: Array<SectionDefinition> = [
	showcaseBentoCardsSection,
	showcaseGridSection,
	showcaseGridHighlightSection,
	showcaseListSection,
	showcaseStripImagesSection,
	showcaseCarouselSection,
	showcaseTextCarouselSection,
];
