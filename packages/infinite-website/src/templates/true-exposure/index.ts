import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { contactFormMapSection } from "../../sections/contact/contact-form-map";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featureThreeCardSection } from "../../sections/features/feature-three-card";
import { footerLogoNavSection } from "../../sections/footer/footer-logo-nav";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerDiagonalGridSection } from "../../sections/hero/banner-diagonal-grid";
import { locationMapSection } from "../../sections/location/location-map";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import { metricsNumbersSection } from "../../sections/metrics/metrics-numbers";
import { pricingTableSection } from "../../sections/pricing/pricing-table";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialGridSection } from "../../sections/testimonials/testimonial-grid";
import { defineTemplate } from "../template-definition";

export const trueExposureTemplate = defineTemplate({
	description:
		"Minimal editorial contrast — sharp corners, clean typography, monochrome palettes, generous whitespace, and disciplined grid layouts. Best for a sophisticated, restrained look.",
	id: "true-exposure",
	layout: {
		footer: {
			footer: footerLogoNavSection,
		},
		header: {
			header: headerBasicSection,
		},
	},
	name: "True Exposure",
	pages: {
		home: {
			home: true,
			sections: {
				"banner-diagonal-grid": bannerDiagonalGridSection,
				"feature-three-card": featureThreeCardSection,
				"gallery-grid": galleryGridSection,
				"text-basic": textBasicSection,
				"showcase-grid": showcaseGridSection,
				"metrics-numbers": metricsNumbersSection,
				"team-grid": teamGridSection,
				"testimonial-grid": testimonialGridSection,
				"pricing-table": pricingTableSection,
				"faq-accordion": faqAccordionSection,
				"cta-background-image": ctaBackgroundImageSection,
				"contact-form-text": contactFormTextSection,
				"contact-form-map": contactFormMapSection,
				"location-text-and-map": locationTextAndMapSection,
				"location-map": locationMapSection,
			},
		},
	},
	tags: ["minimal", "editorial", "refined"],
});
