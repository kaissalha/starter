import { defineSection } from "../section-definition";
import { bannerButtonRow, bannerContentLayout, bannerTextNode } from "./_shared/banner-copy-parts";
import {
	bannerBackgroundImage,
	evenPadding,
	sectionPadding,
	bannerStretchActionsRepeater,
} from "./_shared/banner-image-parts";

export const bannerCardAndBackgroundImageSection = defineSection({
	category: "hero",
	pattern: "banner-card-and-background-image",
	repeaters: [
		bannerStretchActionsRepeater({
			appearances: ["primary", "secondary"],
			initial: 1,
			target: "/props/children/1/props/children/0/props/children/2/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport", position: "relative" },
		props: {
			children: [
				bannerBackgroundImage({ overlay: { kind: "scrim", strength: "medium" } }),
				{
					layout: {
						...bannerContentLayout,
						grow: 1,
						minBlockSize: "viewport",
						padding: sectionPadding({ base: [8, 8], compact: [10, 10] }),
						position: "relative",
					},
					props: {
						align: "end",
						children: [
							{
								layout: {
									inlineSize: { base: "full", compact: "auto" },
									maxInlineSize: "600px",
									padding: { base: evenPadding(6), compact: evenPadding(8) },
								},
								props: {
									children: [
										bannerTextNode({
											appearance: "heading-lg",
											element: "h1",
											pointer: "/copy/heading",
										}),
										bannerTextNode({
											appearance: "body-md",
											pointer: "/copy/description",
											tone: "muted",
										}),
										bannerButtonRow({}),
									],
									direction: "column",
									fill: "canvas",
									foreground: "primary",
									gap: "4sp",
									radius: "theme",
								},
								type: "flex",
							},
						],
						direction: "row",
						justify: "start",
					},
					type: "flex",
				},
			],
			fill: "transparent",
			foreground: "media",
		},
		type: "box",
	},
});
