import { defineSection } from "../section-definition";
import { bannerButtonRow, bannerContentLayout, bannerKicker, bannerTextNode } from "./_shared/banner-copy-parts";
import {
	bannerBackgroundImage,
	evenPadding,
	sectionPadding,
	bannerStretchActionsRepeater,
} from "./_shared/banner-image-parts";

export const bannerCardSection = defineSection({
	category: "hero",
	pattern: "banner-card",
	repeaters: [
		bannerStretchActionsRepeater({
			appearances: ["primary", "outline"],
			target: "/props/children/0/props/children/0/props/children/0/props/children/0/props/children/1/props/children",
		}),
	],
	root: {
		layout: {},
		props: {
			children: [
				{
					layout: {
						...bannerContentLayout,
						padding: sectionPadding({ base: [8, 8], compact: [10, 10] }),
					},
					props: {
						children: [
							{
								layout: { overflow: "hidden" },
								props: {
									children: [
										{
											layout: {
												inlineSize: { base: "full", wide: "50%" },
												padding: {
													base: evenPadding(6),
													compact: evenPadding(8),
													wide: {
														blockEnd: "16sp",
														blockStart: "16sp",
														inlineEnd: "14sp",
														inlineStart: "14sp",
													},
												},
												shrink: 0,
											},
											props: {
												children: [
													{
														layout: { blockSize: "full" },
														props: {
															children: [
																{
																	props: {
																		children: [
																			bannerKicker({}),
																			bannerTextNode({
																				appearance: "display-sm",
																				element: "h1",
																				pointer: "/copy/heading",
																			}),
																			bannerTextNode({
																				appearance: "body-md",
																				pointer: "/copy/description",
																				tone: "muted",
																			}),
																		],
																		direction: "column",
																		gap: "4sp",
																	},
																	type: "flex",
																},
																bannerButtonRow({}),
															],
															direction: "column",
															gap: "6sp",
														},
														type: "flex",
													},
												],
												fill: "tint",
												foreground: "primary",
											},
											type: "box",
										},
										{
											layout: {
												aspectRatio: { base: { height: 3, width: 4 }, wide: "auto" },
												inlineSize: { base: "full", wide: "50%" },
												position: "relative",
												shrink: 0,
											},
											props: { children: [bannerBackgroundImage({})] },
											type: "box",
										},
									],
									direction: { base: "column", wide: "row" },
									radius: "theme",
								},
								type: "flex",
							},
						],
						direction: "column",
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
