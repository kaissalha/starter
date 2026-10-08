import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { contactFormImageSection } from "../../sections/contact/contact-form-image";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featurePortraitCarouselSection } from "../../sections/features/feature-portrait-carousel";
import { featureThreeCardSection } from "../../sections/features/feature-three-card";
import { footerDetachedSection } from "../../sections/footer/footer-detached";
import { gallerySlideshowSection } from "../../sections/gallery/gallery-slideshow";
import { headerDetachedTransparentSection } from "../../sections/header/header-detached-transparent";
import { bannerTextAndBackgroundImageSection } from "../../sections/hero/banner-text-and-background-image";
import { locationMapSection } from "../../sections/location/location-map";
import { metricsCardHighlightSection } from "../../sections/metrics/metrics-card-highlight";
import { pricingTableSection } from "../../sections/pricing/pricing-table";
import { showcaseGridHighlightSection } from "../../sections/showcase/showcase-grid-highlight";
import { teamGridColumnsSection } from "../../sections/team/team-grid-columns";
import { testimonialCarouselCardSection } from "../../sections/testimonials/testimonial-carousel-card";
import { defineTemplate } from "../template-definition";

export const pureVitalityTemplate = defineTemplate({
	description:
		"Electric contrast minimalism — stark dark canvases, vivid accent color, modern sans-serif type, clean layouts, and immersive full-width sections. Best for an energetic, action-oriented look.",
	id: "pure-vitality",
	layout: {
		footer: {
			footer: footerDetachedSection,
		},
		header: {
			header: headerDetachedTransparentSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				hero: bannerTextAndBackgroundImageSection,
				philosophy: featureThreeCardSection,
				classes: featurePortraitCarouselSection,
				gallery: gallerySlideshowSection,
				about: textBasicSection,
				companies: showcaseGridHighlightSection,
				metrics: metricsCardHighlightSection,
				testimonials: testimonialCarouselCardSection,
				team: teamGridColumnsSection,
				pricing: pricingTableSection,
				faq: faqAccordionSection,
				location: locationMapSection,
				contact: contactFormImageSection,
				cta: ctaBackgroundImageSection,
			},
		},
	},
	tags: ["energetic", "modern", "high-contrast"],
});
