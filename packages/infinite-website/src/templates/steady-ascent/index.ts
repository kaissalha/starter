import { ctaBasicSection } from "../../sections/call-to-action/cta-basic";
import { contactFormMapSection } from "../../sections/contact/contact-form-map";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featureGridWithImageSection } from "../../sections/features/feature-grid-with-image";
import { footerInfoGridSection } from "../../sections/footer/footer-info-grid";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerCardAndBackgroundImageSection } from "../../sections/hero/banner-card-and-background-image";
import { locationMapSection } from "../../sections/location/location-map";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import { metricsNumbersSection } from "../../sections/metrics/metrics-numbers";
import { pricingEditorialHighlightSection } from "../../sections/pricing/pricing-editorial-highlight";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialCarouselSection } from "../../sections/testimonials/testimonial-carousel";
import { defineTemplate } from "../template-definition";

export const steadyAscentTemplate = defineTemplate({
	description:
		"Polished aspirational minimalism — clean backgrounds, warm accent tones, clear typographic hierarchy, and structured layouts with subtle visual depth. Best for an approachable, confident look.",
	id: "steady-ascent",
	layout: {
		footer: {
			footer: footerInfoGridSection,
		},
		header: {
			header: headerBasicSection,
		},
	},
	name: "Steady Ascent",
	pages: {
		home: {
			home: true,
			sections: {
				"banner-card-and-background-image": bannerCardAndBackgroundImageSection,
				"feature-grid-with-image": featureGridWithImageSection,
				"testimonial-carousel": testimonialCarouselSection,
				"team-grid": teamGridSection,
				"text-basic": textBasicSection,
				"showcase-grid": showcaseGridSection,
				"gallery-grid": galleryGridSection,
				"faq-accordion": faqAccordionSection,
				"metrics-numbers": metricsNumbersSection,
				"pricing-editorial-highlight": pricingEditorialHighlightSection,
				"contact-form-text": contactFormTextSection,
				"contact-form-map": contactFormMapSection,
				"location-text-and-map": locationTextAndMapSection,
				"location-map": locationMapSection,
				"cta-basic": ctaBasicSection,
			},
		},
	},
	tags: ["professional", "polished", "modern"],
});
