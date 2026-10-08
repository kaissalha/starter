import { contactFormCardSection } from "../../sections/contact/contact-form-card";
import { faqNumberedAccordionSection } from "../../sections/faq/faq-numbered-accordion";
import { featureListBackgroundImageSection } from "../../sections/features/feature-list-background-image";
import { featureStripScrollSection } from "../../sections/features/feature-strip-scroll";
import { footerSplitImageSection } from "../../sections/footer/footer-split-image";
import { galleryMasonrySection } from "../../sections/gallery/gallery-masonry";
import { headerBasicSection } from "../../sections/header/header-basic";
import { bannerEditorialSplitSection } from "../../sections/hero/banner-editorial-split";
import { showcaseCarouselSection } from "../../sections/showcase/showcase-carousel";
import { testimonialParallaxQuoteSection } from "../../sections/testimonials/testimonial-parallax-quote";
import { defineTemplate } from "../template-definition";

export const artisticExpressionTemplate = defineTemplate({
	id: "artistic-expression",
	name: "Artistic Expression",
	description:
		"Editorial gallery-forward template with oversized serif typography, and generous whitespace. Best for a quiet, understated luxury look.",
	tags: ["creative", "modern", "editorial"],
	layout: {
		footer: {
			footer: footerSplitImageSection,
		},
		header: {
			header: headerBasicSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				"banner-editorial-split": bannerEditorialSplitSection,
				services: featureStripScrollSection,
				about: featureListBackgroundImageSection,
				gallery: galleryMasonrySection,
				"testimonial-parallax-quote": testimonialParallaxQuoteSection,
				"showcase-carousel": showcaseCarouselSection,
				"faq-numbered-accordion": faqNumberedAccordionSection,
				contact: contactFormCardSection,
			},
		},
	},
});
