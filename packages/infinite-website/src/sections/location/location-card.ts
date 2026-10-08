import { googleMapSettingsSchema } from "../../document/structure-schema";
import {
	box,
	flex,
	iconItem,
	linkAction,
	mapEmbed,
	sectionRoot,
	space,
	spaceEdges,
	text,
} from "../contact/_shared/blocks";
import { defineSection } from "../section-definition";

const label = (pointer: string) => text({ appearance: "body-md-em", pointer });

const centered = { base: "center", compact: "start" } as const;

export const locationCardSection = defineSection({
	category: "location",
	pattern: "location-card",
	root: sectionRoot({
		children: [
			box({
				children: [
					mapEmbed({
						layout: {
							aspectRatio: { base: { height: 1, width: 1 }, compact: "auto" },
							blockSize: { base: "auto", compact: "full" },
							inlineSize: "full",
							inset: { base: {}, compact: { blockStart: 0, inlineStart: 0 } },
							position: { base: "static", compact: "absolute" },
						},
					}),
					flex({
						align: centered,
						children: [
							iconItem({
								align: centered,
								children: [label("/copy/emailLabel"), linkAction({ appearance: "body-sm", index: 0 })],
								icon: "email",
								iconSize: 4,
								pill: "subtle",
							}),
							iconItem({
								align: centered,
								children: [label("/copy/phoneLabel"), linkAction({ appearance: "body-sm", index: 1 })],
								icon: "phone",
								iconSize: 4,
								pill: "subtle",
							}),
							iconItem({
								align: centered,
								children: [
									label("/copy/addressLabel"),
									text({ appearance: "body-sm", pointer: "/copy/address" }),
									linkAction({ appearance: "body-sm", index: 2 }),
								],
								icon: "location-pin",
								iconSize: 4,
								pill: "subtle",
							}),
						],
						direction: "column",
						fill: "featured",
						foreground: "featured",
						gap: space(6),
						layout: {
							inlineSize: { base: "full", compact: "66.667%", wide: "33.333%" },
							inset: {
								base: {},
								compact: { blockEnd: "16sp", blockStart: "auto", inlineStart: "50%" },
								wide: { blockEnd: "auto", blockStart: "50%", inlineStart: "16sp" },
							},
							padding: spaceEdges({ blockEnd: 6, blockStart: 6, inlineEnd: 6, inlineStart: 6 }),
							position: { base: "relative", compact: "absolute" },
							translate: {
								base: { block: 0, inline: 0 },
								compact: { block: 0, inline: "-50%" },
								wide: { block: "-50%", inline: 0 },
							},
							zIndex: 10,
						},
						radius: "theme",
					}),
				],
				layout: {
					aspectRatio: { base: "auto", compact: { height: 4, width: 3 }, wide: { height: 4, width: 9 } },
					inlineSize: "full",
					position: "relative",
				},
			}),
		],
	}),
	settings: googleMapSettingsSchema,
});
