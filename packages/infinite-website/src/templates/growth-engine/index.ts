import { ctaBasicSection } from "../../sections/call-to-action/cta-basic";
import { contactFormLinksSection } from "../../sections/contact/contact-form-links";
import { contactFormMapSection } from "../../sections/contact/contact-form-map";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featureImagesCarouselSection } from "../../sections/features/feature-images-carousel";
import { footerInfoGridSection } from "../../sections/footer/footer-info-grid";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerMarketerSection } from "../../sections/header/header-marketer";
import { bannerDiagonalGridSection } from "../../sections/hero/banner-diagonal-grid";
import { locationMapSection } from "../../sections/location/location-map";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import { metricsBigNumbersSection } from "../../sections/metrics/metrics-big-numbers";
import { pricingTable3Section } from "../../sections/pricing/pricing-table-3";
import { showcaseStripImagesSection } from "../../sections/showcase/showcase-strip-images";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialSingleCarouselSection } from "../../sections/testimonials/testimonial-single-carousel";
import { defineTemplate } from "../template-definition";

export const growthEngineTemplate = defineTemplate({
	id: "growth-engine",
	name: "Growth Engine",
	description:
		"High-impact monochrome energy — sharp corners, stark contrast, electric accents, strong sans-serif typography, and generous whitespace. Best for a bold look.",
	tags: ["bold", "modern", "high-contrast", "energetic"],
	layout: {
		footer: {
			footer: footerInfoGridSection,
		},
		header: {
			header: headerMarketerSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				"banner-diagonal-grid": bannerDiagonalGridSection,
				"feature-images-carousel": featureImagesCarouselSection,
				"metrics-big-numbers": metricsBigNumbersSection,
				"testimonial-single-carousel": testimonialSingleCarouselSection,
				"text-basic": textBasicSection,
				"faq-accordion": faqAccordionSection,
				"team-grid": teamGridSection,
				"showcase-strip-images": showcaseStripImagesSection,
				"gallery-grid": galleryGridSection,
				"pricing-table-3": pricingTable3Section,
				contact: contactFormLinksSection,
				"contact-form-map": contactFormMapSection,
				"location-text-and-map": locationTextAndMapSection,
				"location-map": locationMapSection,
				"cta-basic": ctaBasicSection,
			},
		},
	},
});
