import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { contactFormMapSection } from "../../sections/contact/contact-form-map";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionImageSection } from "../../sections/faq/faq-accordion-image";
import { featureCarouselSection } from "../../sections/features/feature-carousel";
import { featureGridSection } from "../../sections/features/feature-grid";
import { footerLogoHighlightSection } from "../../sections/footer/footer-logo-highlight";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerFullImageSection } from "../../sections/hero/banner-full-image";
import { locationMapSection } from "../../sections/location/location-map";
import { locationTextAndMapSection } from "../../sections/location/location-text-and-map";
import { metricsBasicSection } from "../../sections/metrics/metrics-basic";
import { pricingTableSection } from "../../sections/pricing/pricing-table";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialGridSection } from "../../sections/testimonials/testimonial-grid";
import { defineTemplate } from "../template-definition";

export const vibrantBloomsTemplate = defineTemplate({
	description:
		"Fresh organic brightness — lively saturated color, earthy undertones, soft rounded corners, and open layouts with generous padding. Best for an inviting, naturally expressive look.",
	id: "vibrant-blooms",
	layout: {
		footer: {
			footer: footerLogoHighlightSection,
		},
		header: {
			header: headerBasicSection,
		},
	},
	name: "Vibrant Blooms",
	pages: {
		home: {
			home: true,
			sections: {
				"banner-full-image": bannerFullImageSection,
				"feature-grid": featureGridSection,
				"feature-carousel": featureCarouselSection,
				"metrics-basic": metricsBasicSection,
				"gallery-grid": galleryGridSection,
				"team-grid": teamGridSection,
				"pricing-table": pricingTableSection,
				"faq-accordion-image": faqAccordionImageSection,
				"cta-background-image": ctaBackgroundImageSection,
				"showcase-grid": showcaseGridSection,
				"text-basic": textBasicSection,
				"testimonial-grid": testimonialGridSection,
				"contact-form-text": contactFormTextSection,
				"contact-form-map": contactFormMapSection,
				"location-text-and-map": locationTextAndMapSection,
				"location-map": locationMapSection,
			},
		},
	},
	tags: ["organic", "bright", "fresh"],
});
