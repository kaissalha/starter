import { ctaBasicSection } from "../../sections/call-to-action/cta-basic";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featureCenteredCarouselSection } from "../../sections/features/feature-centered-carousel";
import { footerInfoGridSection } from "../../sections/footer/footer-info-grid";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerTextAndImageSection } from "../../sections/hero/banner-text-and-image";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import { metricsNumbersSection } from "../../sections/metrics/metrics-numbers";
import { pricingTableSection } from "../../sections/pricing/pricing-table";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridColumnsSection } from "../../sections/team/team-grid-columns";
import { testimonialCarouselCardSection } from "../../sections/testimonials/testimonial-carousel-card";
import { defineTemplate } from "../template-definition";

export const strategicInsightTemplate = defineTemplate({
	description:
		"Warm editorial minimalism — off-white canvas, serif type, generous whitespace, muted natural tones. Best for a refined, professional look.",
	id: "strategic-insight",
	layout: {
		footer: {
			footer: footerInfoGridSection,
		},
		header: {
			header: headerBasicSection,
		},
	},
	name: "Strategic Insight",
	pages: {
		home: {
			home: true,
			sections: {
				"banner-text-and-image": bannerTextAndImageSection,
				"gallery-grid": galleryGridSection,
				"showcase-grid": showcaseGridSection,
				"feature-centered-carousel": featureCenteredCarouselSection,
				"metrics-numbers": metricsNumbersSection,
				"text-basic": textBasicSection,
				"testimonial-carousel-card": testimonialCarouselCardSection,
				"team-grid-columns": teamGridColumnsSection,
				"location-text-and-map": locationTextAndMapSection,
				"pricing-table": pricingTableSection,
				"faq-accordion": faqAccordionSection,
				"contact-form-text": contactFormTextSection,
				"cta-basic": ctaBasicSection,
			},
		},
	},
	tags: ["professional", "editorial", "minimal", "warm"],
});
