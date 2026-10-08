import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featureStickyImageSection } from "../../sections/features/feature-sticky-image";
import { footerLogoHighlightSection } from "../../sections/footer/footer-logo-highlight";
import { galleryFlatBentoSection } from "../../sections/gallery/gallery-flat-bento";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerTextOnlySection } from "../../sections/hero/banner-text-only";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import { metricsNumbersSection } from "../../sections/metrics/metrics-numbers";
import { pricingEditorialHighlightSection } from "../../sections/pricing/pricing-editorial-highlight";
import { showcaseListSection } from "../../sections/showcase/showcase-list";
import { teamGridColumnsSection } from "../../sections/team/team-grid-columns";
import { testimonialCenteredCarouselSection } from "../../sections/testimonials/testimonial-centered-carousel";
import { defineTemplate } from "../template-definition";

export const sharpSignalTemplate = defineTemplate({
	description:
		"Bold saturated maximalism — rich background, chunky serif type, organized layout with horizontal lines through the content.",
	id: "sharp-signal",
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
				hero: bannerTextOnlySection,
				cta: ctaBackgroundImageSection,
				team: teamGridColumnsSection,
				visit: locationTextAndMapSection,
				table: featureStickyImageSection,
				welcome: textBasicSection,
				press: showcaseListSection,
				gallery: galleryFlatBentoSection,
				metrics: metricsNumbersSection,
				testimonials: testimonialCenteredCarouselSection,
				pricing: pricingEditorialHighlightSection,
				faq: faqAccordionSection,
				contact: contactFormTextSection,
			},
		},
	},
	tags: ["bold", "creative", "playful"],
});
