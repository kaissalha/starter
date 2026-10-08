import { googleMapSettingsSchema } from "../../document/structure-schema";
import {
	button,
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

export const locationTextAndMapSection = defineSection({
	category: "location",
	pattern: "location-text-and-map",
	root: sectionRoot({
		children: [
			grid({
				children: [
					flex({
						align: "start",
						children: [
							flex({
								children: [
									flex({ children: [kicker(), heading({})], direction: "column", gap: space(2) }),
									flex({
										align: "start",
										children: [
											description({ appearance: "body-lg" }),
											button({ index: 0, variant: "primary" }),
										],
										direction: "column",
										gap: space(6),
									}),
								],
								direction: "column",
								gap: space(6),
								layout: { maxInlineSize: "36rem" },
							}),
						],
						direction: "column",
						justify: "center",
						layout: {
							padding: {
								base: { blockEnd: 0, blockStart: "12sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
								compact: { blockEnd: "16sp", blockStart: "16sp", inlineEnd: 0, inlineStart: "1.5rem" },
							},
						},
					}),
					mapEmbed({ layout: { blockSize: { base: "72sp", compact: "auto" }, minBlockSize: "72sp" } }),
				],
				columns: { base: 1, compact: 2 },
				gap: space(8),
			}),
		],
	}),
	settings: googleMapSettingsSchema,
});
