import type { SectionDefinition } from "../section-definition";
import { featureBentoGridSection } from "./feature-bento-grid";
import { featureBoxGridSection } from "./feature-box-grid";
import { featureCardCarouselSection } from "./feature-card-carousel";
import { featureCarouselSection } from "./feature-carousel";
import { featureCarouselAccordionSection } from "./feature-carousel-accordion";
import { featureCarouselSplitSection } from "./feature-carousel-split";
import { featureCenteredCarouselSection } from "./feature-centered-carousel";
import { featureExpandableCarouselSection } from "./feature-expandable-carousel";
import { featureGridSection } from "./feature-grid";
import { featureGridWithImageSection } from "./feature-grid-with-image";
import { featureIconsSection } from "./feature-icons";
import { featureImagesCarouselSection } from "./feature-images-carousel";
import { featureListBackgroundImageSection } from "./feature-list-background-image";
import { featureMenuGridSection } from "./feature-menu-grid";
import { featureMenuListSection } from "./feature-menu-list";
import { featureMenuListTextSection } from "./feature-menu-list-text";
import { featureMiniImageCardsSection } from "./feature-mini-image-cards";
import { featurePortraitCarouselSection } from "./feature-portrait-carousel";
import { featureProgressAccordionSection } from "./feature-progress-accordion";
import { featureStickyImageSection } from "./feature-sticky-image";
import { featureStripScrollSection } from "./feature-strip-scroll";
import { featureTextStackedSection } from "./feature-text-stacked";
import { featureThreeCardSection } from "./feature-three-card";
import { featureVideoSection } from "./feature-video";

export const featuresSections: Array<SectionDefinition> = [
	featureBentoGridSection,
	featureCarouselSection,
	featureGridSection,
	featureStickyImageSection,
	featureMenuGridSection,
	featureMenuListSection,
	featureMenuListTextSection,
	featureListBackgroundImageSection,
	featureBoxGridSection,
	featureGridWithImageSection,
	featureIconsSection,
	featureCardCarouselSection,
	featureCenteredCarouselSection,
	featureImagesCarouselSection,
	featureTextStackedSection,
	featureThreeCardSection,
	featureMiniImageCardsSection,
	featurePortraitCarouselSection,
	featureVideoSection,
	featureStripScrollSection,
	featureProgressAccordionSection,
	featureCarouselAccordionSection,
	featureCarouselSplitSection,
	featureExpandableCarouselSection,
];
