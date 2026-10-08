import { ctaEditorialBorderedSection } from "../../sections/call-to-action/cta-editorial-bordered";
import { contactEditorialBorderedSection } from "../../sections/contact/contact-editorial-bordered";
import { blogPortraitGridSection } from "../../sections/content/blog-portrait-grid";
import { faqEditorialBorderedSection } from "../../sections/faq/faq-editorial-bordered";
import { featureBoxGridSection } from "../../sections/features/feature-box-grid";
import { featureCarouselSplitSection } from "../../sections/features/feature-carousel-split";
import { footerPillNavSection } from "../../sections/footer/footer-pill-nav";
import { galleryMosaicSection } from "../../sections/gallery/gallery-mosaic";
import { headerFlushTransparentSection } from "../../sections/header/header-flush-transparent";
import { bannerSplitCardSection } from "../../sections/hero/banner-split-card";
import { metricsEditorialBorderedSection } from "../../sections/metrics/metrics-editorial-bordered";
import { pricingEditorialBorderedSection } from "../../sections/pricing/pricing-editorial-bordered";
import { showcaseTextCarouselSection } from "../../sections/showcase/showcase-text-carousel";
import { teamPortraitGridSection } from "../../sections/team/team-portrait-grid";
import { testimonialBorderedGridSection } from "../../sections/testimonials/testimonial-bordered-grid";
import { defineTemplate } from "../template-definition";

export const sparkleHomeTemplate = defineTemplate({
	description:
		"An editorial template for residential cleaning and home-care businesses. Clean bordered layouts, portrait grids, and polished type for a trustworthy local look.",
	id: "sparkle-home",
	layout: {
		footer: {
			footer: footerPillNavSection,
		},
		header: {
			header: headerFlushTransparentSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				hero: bannerSplitCardSection,
				areas: showcaseTextCarouselSection,
				metrics: metricsEditorialBorderedSection,
				services: featureBoxGridSection,
				process: featureCarouselSplitSection,
				gallery: galleryMosaicSection,
				pricing: pricingEditorialBorderedSection,
				testimonials: testimonialBorderedGridSection,
				team: teamPortraitGridSection,
				faq: faqEditorialBorderedSection,
				blog: blogPortraitGridSection,
				contact: contactEditorialBorderedSection,
				cta: ctaEditorialBorderedSection,
			},
		},
	},
	tags: ["editorial", "polished", "fresh"],
});
