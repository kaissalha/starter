import type { SectionDefinition } from "../section-definition";
import { faqAccordionSection } from "./faq-accordion";
import { faqAccordionImageSection } from "./faq-accordion-image";
import { faqAccordionMergedSection } from "./faq-accordion-merged";
import { faqCardSection } from "./faq-card";
import { faqEditorialBorderedSection } from "./faq-editorial-bordered";
import { faqEditorialSplitSection } from "./faq-editorial-split";
import { faqNumberedAccordionSection } from "./faq-numbered-accordion";
import { faqStretchSection } from "./faq-stretch";

export const faqSections: Array<SectionDefinition> = [
	faqCardSection,
	faqStretchSection,
	faqAccordionSection,
	faqAccordionImageSection,
	faqAccordionMergedSection,
	faqEditorialBorderedSection,
	faqEditorialSplitSection,
	faqNumberedAccordionSection,
];
