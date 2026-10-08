import type { SectionDefinition } from "../section-definition";
import { bannerBackgroundCornerImageSection } from "./banner-background-corner-image";
import { bannerBasicSection } from "./banner-basic";
import { bannerBentoGridSection } from "./banner-bento-grid";
import { bannerBottomCardSection } from "./banner-bottom-card";
import { bannerCardSection } from "./banner-card";
import { bannerCardAndBackgroundImageSection } from "./banner-card-and-background-image";
import { bannerCompactBackgroundSection } from "./banner-compact-background";
import { bannerDiagonalGridSection } from "./banner-diagonal-grid";
import { bannerDoubleCarouselSection } from "./banner-double-carousel";
import { bannerDoubleImageBottomSection } from "./banner-double-image-bottom";
import { bannerEditorialSplitSection } from "./banner-editorial-split";
import { bannerFullImageSection } from "./banner-full-image";
import { bannerGridSection } from "./banner-grid";
import { bannerImageFullSplitSection } from "./banner-image-full-split";
import { bannerOrbitSection } from "./banner-orbit";
import { bannerOversizedParallaxSection } from "./banner-oversized-parallax";
import { bannerSplitCardSection } from "./banner-split-card";
import { bannerTextAndBackgroundImageSection } from "./banner-text-and-background-image";
import { bannerTextAndImageSection } from "./banner-text-and-image";
import { bannerTextOnlySection } from "./banner-text-only";

export const heroSections: Array<SectionDefinition> = [
	bannerDoubleCarouselSection,
	bannerBackgroundCornerImageSection,
	bannerBottomCardSection,
	bannerDoubleImageBottomSection,
	bannerDiagonalGridSection,
	bannerCompactBackgroundSection,
	bannerCardAndBackgroundImageSection,
	bannerCardSection,
	bannerBentoGridSection,
	bannerBasicSection,
	bannerTextOnlySection,
	bannerEditorialSplitSection,
	bannerFullImageSection,
	bannerGridSection,
	bannerImageFullSplitSection,
	bannerOrbitSection,
	bannerOversizedParallaxSection,
	bannerSplitCardSection,
	bannerTextAndBackgroundImageSection,
	bannerTextAndImageSection,
];
