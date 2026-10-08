import { defineSection } from "../section-definition";
import { contentFrame, image, sectionBox } from "./_shared/section-parts";

export const featureVideoSection = defineSection({
	category: "features",
	pattern: "feature-video",
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					image({
						aspectRatio: { height: 9, width: 16 },
						inlineSize: "full",
						pointer: "/media/items/0",
					}),
				],
				padding: { base: "16sp", compact: "20sp" },
			}),
		],
	}),
});
