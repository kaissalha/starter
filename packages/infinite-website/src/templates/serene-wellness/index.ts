import { ctaCardSection } from "../../sections/call-to-action/cta-card";
import { contactFormMapSection } from "../../sections/contact/contact-form-map";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionImageSection } from "../../sections/faq/faq-accordion-image";
import { featureExpandableCarouselSection } from "../../sections/features/feature-expandable-carousel";
import { footerInfoGridSection } from "../../sections/footer/footer-info-grid";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerOrbitSection } from "../../sections/hero/banner-orbit";
import { locationMapSection } from "../../sections/location/location-map";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import { metricsBasicSection } from "../../sections/metrics/metrics-basic";
import { pricingTable2Section } from "../../sections/pricing/pricing-table-2";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialCarouselSection } from "../../sections/testimonials/testimonial-carousel";
import { defineTemplate } from "../template-definition";

export const sereneWellnessTemplate = defineTemplate({
	description:
		"Airy geometric minimalism — light canvas, clean sans-serif type, circular orbital layout. Best for a fresh, modern look.",
	id: "serene-wellness",
	layout: {
		footer: {
			footer: footerInfoGridSection,
		},
		header: {
			header: headerBasicSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				hero: bannerOrbitSection,
				gallery: galleryGridSection,
				services: featureExpandableCarouselSection,
				metrics: metricsBasicSection,
				testimonials: testimonialCarouselSection,
				team: teamGridSection,
				about: textBasicSection,
				press: showcaseGridSection,
				cta: ctaCardSection,
				faq: faqAccordionImageSection,
				pricing: pricingTable2Section,
				contact: contactFormTextSection,
				"contact-map": contactFormMapSection,
				visit: locationTextAndMapSection,
				map: locationMapSection,
			},
		},
	},
	tags: ["fresh", "modern", "minimal", "bright"],
});
