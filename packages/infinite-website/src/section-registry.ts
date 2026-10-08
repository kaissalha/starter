import { callToActionSections } from "./sections/call-to-action";
import { contactSections } from "./sections/contact";
import { contentSections } from "./sections/content";
import { faqSections } from "./sections/faq";
import { featuresSections } from "./sections/features";
import { footerSections } from "./sections/footer";
import { gallerySections } from "./sections/gallery";
import { headerSections } from "./sections/header";
import { heroSections } from "./sections/hero";
import { locationSections } from "./sections/location";
import { metricsSections } from "./sections/metrics";
import { pricingSections } from "./sections/pricing";
import type { SectionDefinition } from "./sections/section-definition";
import { showcaseSections } from "./sections/showcase";
import { teamSections } from "./sections/team";
import { testimonialsSections } from "./sections/testimonials";

export const sectionDefinitions: Array<SectionDefinition> = [
	...callToActionSections,
	...contactSections,
	...contentSections,
	...faqSections,
	...featuresSections,
	...footerSections,
	...gallerySections,
	...headerSections,
	...heroSections,
	...locationSections,
	...metricsSections,
	...pricingSections,
	...showcaseSections,
	...teamSections,
	...testimonialsSections,
];

if (new Set(sectionDefinitions.map((definition) => definition.pattern)).size !== sectionDefinitions.length) {
	throw new Error("Infinite Website section patterns must be unique");
}

export const sectionRegistry: ReadonlyMap<string, SectionDefinition> = new Map(
	sectionDefinitions.map((definition) => [definition.pattern, definition])
);
