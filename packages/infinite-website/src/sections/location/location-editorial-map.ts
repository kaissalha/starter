import { googleMapSettingsSchema } from "../../document/structure-schema";
import {
	button,
	contentLayout,
	description,
	flex,
	grid,
	heading,
	kicker,
	mapEmbed,
	sectionRoot,
	space,
} from "../contact/_shared/blocks";
import { defineSection } from "../section-definition";

export const locationEditorialMapSection = defineSection({
	category: "location",
	pattern: "location-editorial-map",
	root: sectionRoot({
		children: [
			flex({
				children: [
					flex({
						children: [
							kicker(),
							grid({
								children: [
									heading({ layout: { maxInlineSize: "36rem" } }),
									flex({
										align: "start",
										children: [
											description({ layout: { maxInlineSize: "32rem" } }),
											button({ index: 0, variant: "outline" }),
										],
										direction: "column",
										gap: space(4),
									}),
								],
								columns: { base: 1, wide: 2 },
								gap: space(6),
							}),
						],
						direction: "column",
						gap: space(4),
					}),
					mapEmbed({ layout: { aspectRatio: { height: 9, width: 16 } }, radius: "theme" }),
				],
				direction: "column",
				gap: space(12),
				layout: contentLayout(),
			}),
		],
	}),
	settings: googleMapSettingsSchema,
});
