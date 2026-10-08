import { ctaCard2Section } from "../../sections/call-to-action/cta-card-2";
import { contactFormLinksSection } from "../../sections/contact/contact-form-links";
import { faqAccordionImageSection } from "../../sections/faq/faq-accordion-image";
import { featureBentoGridSection } from "../../sections/features/feature-bento-grid";
import { featurePortraitCarouselSection } from "../../sections/features/feature-portrait-carousel";
import { footerLogoHighlightSection } from "../../sections/footer/footer-logo-highlight";
import { galleryBentoSection } from "../../sections/gallery/gallery-bento";
import { galleryFlatBentoSection } from "../../sections/gallery/gallery-flat-bento";
import { headerMarketerSection } from "../../sections/header/header-marketer";
import { bannerTextAndBackgroundImageSection } from "../../sections/hero/banner-text-and-background-image";
import { locationCardSection } from "../../sections/location/location-card";
import { metricsNumbersSection } from "../../sections/metrics/metrics-numbers";
import { pricingTable3Section } from "../../sections/pricing/pricing-table-3";
import { showcaseListSection } from "../../sections/showcase/showcase-list";
import { teamGridColumnsSection } from "../../sections/team/team-grid-columns";
import { testimonialFullscreenSliderSection } from "../../sections/testimonials/testimonial-fullscreen-slider";
import { defineTemplate } from "../template-definition";

export const pawVoyageTemplate = defineTemplate({
	id: "paw-voyage",
	name: "Paw Voyage",
	description:
		"Warm playful clarity — cream canvas, bold orange accents, friendly sans-serif type, rounded details, and bento-style layouts. Best for a fun, approachable look.",
	tags: ["playful", "friendly", "warm"],
	layout: {
		footer: {
			footer: footerLogoHighlightSection,
		},
		header: {
			header: headerMarketerSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				"banner-text-and-background-image": bannerTextAndBackgroundImageSection,
				"feature-bento-grid": featureBentoGridSection,
				"gallery-flat-bento": galleryFlatBentoSection,
				"feature-portrait-carousel": featurePortraitCarouselSection,
				"gallery-bento": galleryBentoSection,
				"showcase-list": showcaseListSection,
				"metrics-numbers": metricsNumbersSection,
				"testimonial-fullscreen-slider": testimonialFullscreenSliderSection,
				"team-grid-columns": teamGridColumnsSection,
				"pricing-table-3": pricingTable3Section,
				"faq-accordion-image": faqAccordionImageSection,
				"location-card": locationCardSection,
				"contact-form-links": contactFormLinksSection,
				"cta-card-2": ctaCard2Section,
			},
		},
	},
});
