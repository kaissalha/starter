import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionImageSection } from "../../sections/faq/faq-accordion-image";
import { featureExpandableCarouselSection } from "../../sections/features/feature-expandable-carousel";
import { footerLogoHighlightSection } from "../../sections/footer/footer-logo-highlight";
import { galleryFlatBentoSection } from "../../sections/gallery/gallery-flat-bento";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerTextAndImageSection } from "../../sections/hero/banner-text-and-image";
import { locationMapSection } from "../../sections/location/location-map";
import { metricsCardGridSection } from "../../sections/metrics/metrics-card-grid";
import { pricingTable2Section } from "../../sections/pricing/pricing-table-2";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialFullscreenSliderSection } from "../../sections/testimonials/testimonial-fullscreen-slider";
import { defineTemplate } from "../template-definition";

export const heritageDriveTemplate = defineTemplate({
	id: "heritage-drive",
	name: "Heritage Drive",
	description:
		"Heritage editorial refinement — deep green accents, warm canvas backgrounds, generous spacing, and bento grids with a composed rhythm. Best for a polished, timeless look.",
	tags: ["refined", "editorial", "timeless"],
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
				"banner-text-and-image": bannerTextAndImageSection,
				"feature-expandable-carousel": featureExpandableCarouselSection,
				"gallery-flat-bento": galleryFlatBentoSection,
				"testimonial-fullscreen-slider": testimonialFullscreenSliderSection,
				"metrics-card-grid": metricsCardGridSection,
				"contact-form-text": contactFormTextSection,
				"showcase-grid": showcaseGridSection,
				"pricing-table-2": pricingTable2Section,
				"text-basic": textBasicSection,
				"team-grid": teamGridSection,
				"faq-accordion-image": faqAccordionImageSection,
				"location-map": locationMapSection,
				"cta-background-image": ctaBackgroundImageSection,
			},
		},
	},
});
