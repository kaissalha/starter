import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { contactFormImageSection } from "../../sections/contact/contact-form-image";
import { contactFormMapSection } from "../../sections/contact/contact-form-map";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featureBentoGridSection } from "../../sections/features/feature-bento-grid";
import { footerLogoNavSection } from "../../sections/footer/footer-logo-nav";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerCardSection } from "../../sections/hero/banner-card";
import { locationMapSection } from "../../sections/location/location-map";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import { metricsBasicSection } from "../../sections/metrics/metrics-basic";
import { pricingTableSection } from "../../sections/pricing/pricing-table";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialCarouselSection } from "../../sections/testimonials/testimonial-carousel";
import { defineTemplate } from "../template-definition";

export const urbanEdgeTemplate = defineTemplate({
	description:
		"Urban high-contrast intensity — near-black tones, electric orange accents, sharp corners, and modern typography. Best for a powerful, high-energy look.",
	id: "urban-edge",
	layout: {
		footer: {
			footer: footerLogoNavSection,
		},
		header: {
			header: headerBasicSection,
		},
	},
	name: "Urban Edge",
	pages: {
		home: {
			home: true,
			sections: {
				"banner-card": bannerCardSection,
				"feature-bento-grid": featureBentoGridSection,
				"gallery-grid": galleryGridSection,
				"text-basic": textBasicSection,
				"showcase-grid": showcaseGridSection,
				"metrics-basic": metricsBasicSection,
				"testimonial-carousel": testimonialCarouselSection,
				"team-grid": teamGridSection,
				"pricing-table": pricingTableSection,
				"faq-accordion": faqAccordionSection,
				"cta-background-image": ctaBackgroundImageSection,
				"contact-form-image": contactFormImageSection,
				"contact-form-map": contactFormMapSection,
				"location-text-and-map": locationTextAndMapSection,
				"location-map": locationMapSection,
			},
		},
	},
	tags: ["bold", "energetic", "high-contrast"],
});
