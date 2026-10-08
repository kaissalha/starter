import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { contactFormMapSection } from "../../sections/contact/contact-form-map";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqCardSection } from "../../sections/faq/faq-card";
import { featureCenteredCarouselSection } from "../../sections/features/feature-centered-carousel";
import { footerLogoNavSection } from "../../sections/footer/footer-logo-nav";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerMarketerSection } from "../../sections/header/header-marketer";
import { bannerBentoGridSection } from "../../sections/hero/banner-bento-grid";
import { locationMapSection, locationTextAndMapSection } from "../../sections/location";
import { metricsBasicSection } from "../../sections/metrics/metrics-basic";
import { pricingTableSection } from "../../sections/pricing/pricing-table";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialGridSection } from "../../sections/testimonials/testimonial-grid";
import { defineTemplate } from "../template-definition";

export const midnightAuroraTemplate = defineTemplate({
	id: "midnight-aurora",
	name: "Midnight Aurora",
	description:
		"Dramatic premium minimalism — dark canvases, luminous accent color, large rounded forms, crisp sans-serif type, and structured high-contrast layouts. Best for a polished, professional look.",
	tags: ["premium", "dramatic", "professional", "modern"],
	layout: {
		footer: {
			footer: footerLogoNavSection,
		},
		header: {
			header: headerMarketerSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				"banner-bento-grid": bannerBentoGridSection,
				"feature-centered-carousel": featureCenteredCarouselSection,
				"gallery-grid": galleryGridSection,
				"metrics-basic": metricsBasicSection,
				"team-grid": teamGridSection,
				"testimonial-grid": testimonialGridSection,
				"showcase-grid": showcaseGridSection,
				"text-basic": textBasicSection,
				"pricing-table": pricingTableSection,
				"faq-card": faqCardSection,
				"contact-form-text": contactFormTextSection,
				"contact-form-map": contactFormMapSection,
				"location-text-and-map": locationTextAndMapSection,
				"location-map": locationMapSection,
				"cta-background-image": ctaBackgroundImageSection,
			},
		},
	},
});
