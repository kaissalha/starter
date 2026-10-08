import { ctaCard2Section } from "../../sections/call-to-action/cta-card-2";
import { contactFormMapSection } from "../../sections/contact/contact-form-map";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionImageSection } from "../../sections/faq/faq-accordion-image";
import { featureGridSection } from "../../sections/features/feature-grid";
import { footerLogoNavSection } from "../../sections/footer/footer-logo-nav";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerDetachedTransparentSection } from "../../sections/header/header-detached-transparent";
import { bannerCardSection } from "../../sections/hero/banner-card";
import { locationMapSection } from "../../sections/location/location-map";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import { metricsCardGridSection } from "../../sections/metrics/metrics-card-grid";
import { pricingTable2Section } from "../../sections/pricing/pricing-table-2";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialCarouselSection } from "../../sections/testimonials/testimonial-carousel";
import { defineTemplate } from "../template-definition";

export const reliableCoreTemplate = defineTemplate({
	description:
		"Structured modern clarity — balanced chromatic palettes, moderate rounded corners, clean sans-serif typography, and organized grid layouts. Best for a dependable, polished look.",
	id: "reliable-core",
	layout: {
		footer: {
			footer: footerLogoNavSection,
		},
		header: {
			header: headerDetachedTransparentSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				hero: bannerCardSection,
				clients: showcaseGridSection,
				services: featureGridSection,
				testimonials: testimonialCarouselSection,
				team: teamGridSection,
				about: textBasicSection,
				gallery: galleryGridSection,
				metrics: metricsCardGridSection,
				faq: faqAccordionImageSection,
				pricing: pricingTable2Section,
				cta: ctaCard2Section,
				contact: contactFormTextSection,
				"contact-map": contactFormMapSection,
				visit: locationTextAndMapSection,
				map: locationMapSection,
			},
		},
	},
	tags: ["professional", "modern", "structured"],
});
