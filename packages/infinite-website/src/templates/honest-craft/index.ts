import { ctaBackgroundImageSection } from "../../sections/call-to-action/cta-background-image";
import { contactFormImageSection } from "../../sections/contact/contact-form-image";
import { textBasicSection } from "../../sections/content/text-basic";
import { faqAccordionSection } from "../../sections/faq/faq-accordion";
import { featureBentoGridSection } from "../../sections/features/feature-bento-grid";
import { footerInfoGridSection } from "../../sections/footer/footer-info-grid";
import { galleryGridSection } from "../../sections/gallery/gallery-grid";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerDoubleImageBottomSection } from "../../sections/hero/banner-double-image-bottom";
import { locationMapSection } from "../../sections/location/location-map";
import { metricsBasicSection } from "../../sections/metrics/metrics-basic";
import { pricingTableSection } from "../../sections/pricing/pricing-table";
import { showcaseGridSection } from "../../sections/showcase/showcase-grid";
import { teamGridColumnsSection } from "../../sections/team/team-grid-columns";
import { testimonialGridSection } from "../../sections/testimonials/testimonial-grid";
import { defineTemplate } from "../template-definition";

export const honestCraftTemplate = defineTemplate({
	id: "honest-craft",
	name: "Honest Craft",
	description:
		"Warm craftsman structure — light beige canvas, wood-toned warmth, bold orange accents, sharp square corners, and blocky bento-style layouts. Best for a trustworthy, handcrafted look.",
	tags: ["warm", "rustic", "structured"],
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
				"banner-double-image-bottom": bannerDoubleImageBottomSection,
				"feature-bento-grid": featureBentoGridSection,
				"text-basic": textBasicSection,
				"showcase-grid": showcaseGridSection,
				"gallery-grid": galleryGridSection,
				"metrics-basic": metricsBasicSection,
				"team-grid-columns": teamGridColumnsSection,
				"testimonial-grid": testimonialGridSection,
				"pricing-table": pricingTableSection,
				"faq-accordion": faqAccordionSection,
				"location-map": locationMapSection,
				"contact-form-image": contactFormImageSection,
				"cta-background-image": ctaBackgroundImageSection,
			},
		},
	},
});
