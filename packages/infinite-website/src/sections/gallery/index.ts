import type { SectionDefinition } from "../section-definition";
import { galleryBentoSection } from "./gallery-bento";
import { galleryBentoEditorialSection } from "./gallery-bento-editorial";
import { galleryCarouselSection } from "./gallery-carousel";
import { galleryCenterStageSection } from "./gallery-center-stage";
import { galleryFlatBentoSection } from "./gallery-flat-bento";
import { galleryGridSection } from "./gallery-grid";
import { galleryMasonrySection } from "./gallery-masonry";
import { galleryMosaicSection } from "./gallery-mosaic";
import { gallerySlideshowSection } from "./gallery-slideshow";
import { gallerySlideshowLabelledSection } from "./gallery-slideshow-labelled";

export const gallerySections: Array<SectionDefinition> = [
	galleryBentoSection,
	galleryBentoEditorialSection,
	galleryCarouselSection,
	galleryCenterStageSection,
	galleryFlatBentoSection,
	galleryGridSection,
	galleryMasonrySection,
	galleryMosaicSection,
	gallerySlideshowSection,
	gallerySlideshowLabelledSection,
];
