import { featureThreeCardSection } from "../../sections/features/feature-three-card";
import { footerInfoGridSection } from "../../sections/footer/footer-info-grid";
import { gallerySlideshowSection } from "../../sections/gallery/gallery-slideshow";
import { headerDetachedTransparentSection } from "../../sections/header/header-detached-transparent";
import { bannerCardAndBackgroundImageSection } from "../../sections/hero/banner-card-and-background-image";
import { bannerTextAndBackgroundImageSection } from "../../sections/hero/banner-text-and-background-image";
import { metricsBasicSection } from "../../sections/metrics/metrics-basic";
import { testimonialGridSection } from "../../sections/testimonials/testimonial-grid";
import { defineTemplate } from "../template-definition";

export const nordicEdgeTemplate = defineTemplate({
	id: "nordic-edge",
	name: "Nordic Edge",
	description:
		"Warm cream canvas, elegant serif type, balanced layout. Best for a serene, polished look with understated depth.",
	tags: ["calm", "minimal", "warm"],
	layout: {
		footer: {
			footer: footerInfoGridSection,
		},
		header: {
			header: headerDetachedTransparentSection,
		},
	},
	pages: {
		home: {
			home: true,
			sections: {
				"banner-text-and-background-image": bannerTextAndBackgroundImageSection,
				"feature-three-card": featureThreeCardSection,
				"gallery-slideshow": gallerySlideshowSection,
				"metrics-basic": metricsBasicSection,
				"testimonial-grid": testimonialGridSection,
				"banner-card-and-background-image": bannerCardAndBackgroundImageSection,
			},
		},
	},
});
