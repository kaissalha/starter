import { ctaBasicSection } from "../../sections/call-to-action/cta-basic";
import { contactFormMapSection } from "../../sections/contact/contact-form-map";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featureGridSection } from "../../sections/features/feature-grid";
import { featureMenuListSection } from "../../sections/features/feature-menu-list";
import { footerLogoHighlightSection } from "../../sections/footer/footer-logo-highlight";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerGridSection } from "../../sections/hero/banner-grid";
import { locationMapSection } from "../../sections/location/location-map";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import { metricsCardGridSection } from "../../sections/metrics/metrics-card-grid";
import { pricingTableSection } from "../../sections/pricing/pricing-table";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialGridSection } from "../../sections/testimonials/testimonial-grid";
import { defineTemplate } from "../template-definition";

export const artisanCraftTemplate = defineTemplate({
	id: "artisan-craft",
	name: "Artisan Craft",
	description:
		"Warm look, serif typography, earthy tones, soft cream canvas, unfussy layout. Best for a rustic, handcrafted look.",
	tags: ["warm", "rustic", "organic"],
	layout: {
		footer: {
			footer: footerLogoHighlightSection,
		},
		header: {
			header: headerBasicSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				"banner-grid": bannerGridSection,
				"gallery-grid": galleryGridSection,
				"feature-menu-list": featureMenuListSection,
				"feature-grid": featureGridSection,
				"metrics-card-grid": metricsCardGridSection,
				"text-basic": textBasicSection,
				"testimonial-grid": testimonialGridSection,
				"showcase-grid": showcaseGridSection,
				"team-grid": teamGridSection,
				"faq-accordion": faqAccordionSection,
				"pricing-table": pricingTableSection,
				contact: contactFormTextSection,
				"contact-form-map": contactFormMapSection,
				"location-text-and-map": locationTextAndMapSection,
				"location-map": locationMapSection,
				"cta-basic": ctaBasicSection,
			},
		},
	},
});
