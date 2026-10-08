import type { SectionDefinition } from "../section-definition";
import { ctaBackgroundImageSection } from "./cta-background-image";
import { ctaBasicSection } from "./cta-basic";
import { ctaCardSection } from "./cta-card";
import { ctaCard2Section } from "./cta-card-2";
import { ctaEditorialBorderedSection } from "./cta-editorial-bordered";
import { ctaEditorialImageSection } from "./cta-editorial-image";

export const callToActionSections: Array<SectionDefinition> = [
	ctaBackgroundImageSection,
	ctaBasicSection,
	ctaCardSection,
	ctaEditorialImageSection,
	ctaCard2Section,
	ctaEditorialBorderedSection,
];
