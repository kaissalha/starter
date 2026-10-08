import { ctaEditorialImageSection } from "../../sections/call-to-action/cta-editorial-image";
import { contactEditorialSplitSection } from "../../sections/contact/contact-editorial-split";
import { faqEditorialSplitSection } from "../../sections/faq/faq-editorial-split";
import { featureProgressAccordionSection } from "../../sections/features/feature-progress-accordion";
import { footerEditorialSplitSection } from "../../sections/footer/footer-editorial-split";
import { galleryCenterStageSection } from "../../sections/gallery/gallery-center-stage";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerBottomCardSection } from "../../sections/hero/banner-bottom-card";
import { bannerTextAndImageSection } from "../../sections/hero/banner-text-and-image";
import { locationEditorialMapSection } from "../../sections/location/location-editorial-map";
import { metricsEditorialSplitSection } from "../../sections/metrics/metrics-editorial-split";
import { pricingEditorialHighlightSection } from "../../sections/pricing/pricing-editorial-highlight";
import { teamEditorialGridSection } from "../../sections/team/team-editorial-grid";
import { testimonialBackgroundCardsSection } from "../../sections/testimonials/testimonial-background-cards";
import { defineTemplate } from "../template-definition";

export const professionalStructureTemplate = defineTemplate({
	description:
		"A clean, professional template with muted tones and clear hierarchy, and organized grid layouts. Best for a polished, sophisticated look.",
	id: "professional-structure",
	layout: {
		footer: {
			footer: footerEditorialSplitSection,
		},
		header: {
			header: headerBasicSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				hero: bannerBottomCardSection,
				services: featureProgressAccordionSection,
				testimonials: testimonialBackgroundCardsSection,
				about: bannerTextAndImageSection,
				team: teamEditorialGridSection,
				metrics: metricsEditorialSplitSection,
				gallery: galleryCenterStageSection,
				faq: faqEditorialSplitSection,
				pricing: pricingEditorialHighlightSection,
				contact: contactEditorialSplitSection,
				location: locationEditorialMapSection,
				cta: ctaEditorialImageSection,
			},
		},
	},
	tags: ["professional", "polished"],
});
