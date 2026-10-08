import { contactFormWatermarkSection } from "../../sections/contact/contact-form-watermark";
import { blogListSection } from "../../sections/content/blog-list";
import { textScrollRevealSection } from "../../sections/content/text-scroll-reveal";
import { featureStickyImageSection } from "../../sections/features/feature-sticky-image";
import { footerContactSplitSection } from "../../sections/footer/footer-contact-split";
import { galleryBentoEditorialSection } from "../../sections/gallery/gallery-bento-editorial";
import { headerPillNavSection } from "../../sections/header/header-pill-nav";
import { bannerCompactBackgroundSection } from "../../sections/hero/banner-compact-background";
import { teamStaggeredSection } from "../../sections/team/team-staggered";
import { testimonialCenteredCarouselSection } from "../../sections/testimonials/testimonial-centered-carousel";
import { defineTemplate } from "../template-definition";

export const airySpaciousTemplate = defineTemplate({
	id: "airy-spacious",
	name: "Airy Spacious",
	description:
		"Moody minimalist template with generous whitespace. Best for a creative, premium look with quiet drama.",
	tags: ["creative", "premium"],
	layout: {
		footer: {
			footer: footerContactSplitSection,
		},
		header: {
			header: headerPillNavSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				"banner-compact-background": bannerCompactBackgroundSection,
				"text-scroll-reveal": textScrollRevealSection,
				"team-staggered": teamStaggeredSection,
				"testimonial-centered-carousel": testimonialCenteredCarouselSection,
				"gallery-bento-editorial": galleryBentoEditorialSection,
				"feature-sticky-image": featureStickyImageSection,
				"blog-list": blogListSection,
				contact: contactFormWatermarkSection,
			},
		},
	},
});
