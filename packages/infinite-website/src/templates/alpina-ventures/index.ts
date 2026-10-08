import { ctaBasicSection } from "../../sections/call-to-action/cta-basic";
import { contactFormTextSection } from "../../sections/contact/contact-form-text";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featurePortraitCarouselSection } from "../../sections/features/feature-portrait-carousel";
import { featureTextStackedSection } from "../../sections/features/feature-text-stacked";
import { footerInfoGridSection } from "../../sections/footer/footer-info-grid";
import { galleryFlatBentoSection } from "../../sections/gallery/gallery-flat-bento";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerTextAndImageSection } from "../../sections/hero/banner-text-and-image";
import { locationBusinessHoursSection } from "../../sections/location/location-business-hours";
import { metricsBasicSection } from "../../sections/metrics/metrics-basic";
import { pricingTable3Section } from "../../sections/pricing/pricing-table-3";
import { showcaseListSection } from "../../sections/showcase/showcase-list";
import { teamGridSection } from "../../sections/team/team-grid";
import { testimonialCarouselSection } from "../../sections/testimonials/testimonial-carousel";
import { defineTemplate } from "../template-definition";

export const alpinaVenturesTemplate = defineTemplate({
	id: "alpina-ventures",
	name: "Alpina Ventures",
	description:
		"Bold electric minimalism — saturated monochromatic base, crisp white sans-serif type, high contrast. Best for a bold, electric look.",
	tags: ["bold", "modern", "high-contrast"],
	layout: {
		footer: {
			footer: footerInfoGridSection,
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
				"feature-portrait-carousel": featurePortraitCarouselSection,
				"metrics-basic": metricsBasicSection,
				"testimonial-carousel": testimonialCarouselSection,
				"cta-basic": ctaBasicSection,
				"gallery-grid": galleryGridSection,
				"showcase-list": showcaseListSection,
				"pricing-table-3": pricingTable3Section,
				"team-grid": teamGridSection,
				"faq-accordion": faqAccordionSection,
				"cta-basic-2": ctaBasicSection,
				"gallery-flat-bento": galleryFlatBentoSection,
				"location-business-hours": locationBusinessHoursSection,
				contact: contactFormTextSection,
				"text-basic": textBasicSection,
				"feature-text-stacked": featureTextStackedSection,
				"text-basic-2": textBasicSection,
			},
		},
	},
});
