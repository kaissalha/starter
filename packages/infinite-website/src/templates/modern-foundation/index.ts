import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { contactFormImageSection } from "../../sections/contact/contact-form-image";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featureGridWithImageSection } from "../../sections/features/feature-grid-with-image";
import { footerLogoHighlightSection } from "../../sections/footer/footer-logo-highlight";
import { galleryFlatBentoSection } from "../../sections/gallery/gallery-flat-bento";
import { headerDetachedTransparentSection } from "../../sections/header/header-detached-transparent";
import { bannerTextAndImageSection } from "../../sections/hero/banner-text-and-image";
import { locationMapSection } from "../../sections/location/location-map";
import { metricsNumbersSection } from "../../sections/metrics/metrics-numbers";
import { pricingTableSection } from "../../sections/pricing/pricing-table";
import { showcaseListSection } from "../../sections/showcase/showcase-list";
import { teamGridColumnsSection } from "../../sections/team/team-grid-columns";
import { testimonialSingleCarouselSection } from "../../sections/testimonials/testimonial-single-carousel";
import { defineTemplate } from "../template-definition";

export const modernFoundationTemplate = defineTemplate({
	id: "modern-foundation",
	name: "Modern Foundation",
	description:
		"Soft structural minimalism — cream canvas, warm terracotta accents, elegant serif type, rounded corners, and balanced bento-style layouts. Best for a refined, contemporary look with calm confidence.",
	tags: ["refined", "modern", "minimal"],
	layout: {
		footer: {
			footer: footerLogoHighlightSection,
		},
		header: {
			header: headerDetachedTransparentSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				"banner-text-and-image": bannerTextAndImageSection,
				"feature-grid-with-image": featureGridWithImageSection,
				"gallery-flat-bento": galleryFlatBentoSection,
				"text-basic": textBasicSection,
				"showcase-list": showcaseListSection,
				"metrics-numbers": metricsNumbersSection,
				"team-grid-columns": teamGridColumnsSection,
				"testimonial-single-carousel": testimonialSingleCarouselSection,
				"pricing-table": pricingTableSection,
				"faq-accordion": faqAccordionSection,
				"contact-form-image": contactFormImageSection,
				"location-map": locationMapSection,
				"cta-background-image": ctaBackgroundImageSection,
			},
		},
	},
});
