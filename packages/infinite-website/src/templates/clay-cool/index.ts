import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { contactFormImageSection } from "../../sections/contact/contact-form-image";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featureMenuGridSection } from "../../sections/features/feature-menu-grid";
import { featureThreeCardSection } from "../../sections/features/feature-three-card";
import { footerDetachedSection } from "../../sections/footer/footer-detached";
import { galleryCenterStageSection } from "../../sections/gallery/gallery-center-stage";
import { headerMarketerSection } from "../../sections/header/header-marketer";
import { bannerFullImageSection } from "../../sections/hero/banner-full-image";
import { locationCardSection } from "../../sections/location/location-card";
import { metricsNumbersSection } from "../../sections/metrics/metrics-numbers";
import { pricingTable2Section } from "../../sections/pricing/pricing-table-2";
import { showcaseListSection } from "../../sections/showcase/showcase-list";
import { teamGridColumnsSection } from "../../sections/team/team-grid-columns";
import { testimonialSingleCarouselSection } from "../../sections/testimonials/testimonial-single-carousel";
import { defineTemplate } from "../template-definition";

export const clayCoolTemplate = defineTemplate({
	id: "clay-cool",
	name: "Clay Cool",
	description:
		"Moody artisan minimalism — dark slate canvas, serif and sans-serif mix, muted organic tones, clean grid layout. Best for a sophisticated, understated look.",
	tags: ["moody", "creative", "minimal"],
	layout: {
		footer: {
			footer: footerDetachedSection,
		},
		header: {
			header: headerMarketerSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				"banner-full-image": bannerFullImageSection,
				"feature-menu-grid": featureMenuGridSection,
				"cta-background-image": ctaBackgroundImageSection,
				"feature-three-card": featureThreeCardSection,
				"cta-background-image-2": ctaBackgroundImageSection,
				"testimonial-single-carousel": testimonialSingleCarouselSection,
				"location-card": locationCardSection,
				"faq-accordion": faqAccordionSection,
				"gallery-center-stage": galleryCenterStageSection,
				"text-basic": textBasicSection,
				"showcase-list": showcaseListSection,
				"metrics-numbers": metricsNumbersSection,
				"pricing-table-2": pricingTable2Section,
				contact: contactFormImageSection,
				"team-grid-columns": teamGridColumnsSection,
				"get-started": bannerFullImageSection,
			},
		},
	},
});
