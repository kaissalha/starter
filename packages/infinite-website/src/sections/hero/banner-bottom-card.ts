import { defineSection } from "../section-definition";
import { bannerButtonRow, bannerContentLayout, bannerKicker, bannerTextNode } from "./_shared/banner-copy-parts";
import { bannerBackgroundImage, evenPadding, bannerStretchActionsRepeater } from "./_shared/banner-image-parts";

const wideEdges = { blockEnd: "10sp", blockStart: "10sp", inlineEnd: "8sp", inlineStart: "8sp" };

const kicker = bannerKicker({});

export const bannerBottomCardSection = defineSection({
	category: "hero",
	pattern: "banner-bottom-card",
	repeaters: [
		bannerStretchActionsRepeater({
			appearances: ["primary", "secondary"],
			initial: 1,
			target: "/props/children/1/props/children/0/props/children/2/props/children/1/props/children/1/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport", position: "relative" },
		props: {
			children: [
				bannerBackgroundImage({}),
				{
					layout: {
						...bannerContentLayout,
						grow: 1,
						minBlockSize: "viewport",
						padding: {
							base: { blockEnd: "12sp", blockStart: "16sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
							compact: {
								blockEnd: "16sp",
								blockStart: "20sp",
								inlineEnd: "1.5rem",
								inlineStart: "1.5rem",
							},
						},
						position: "relative",
					},
					props: {
						children: [
							{
								layout: { overflow: "hidden" },
								props: {
									children: [
										{
											layout: {
												padding: {
													base: evenPadding(6),
													compact: evenPadding(8),
													wide: wideEdges,
												},
											},
											props: {
												children: [
													kicker,
													bannerTextNode({
														appearance: "display-md",
														element: "h1",
														pointer: "/copy/heading",
													}),
												],
												direction: "column",
												gap: "4sp",
											},
											type: "flex",
										},
										{
											layout: {
												blockSize: "full",
												inlineSize: "1px",
												visibility: { base: "removed", wide: "visible" },
											},
											props: {
												children: [],
												decorative: true,
												fill: "current",
												foreground: "muted",
											},
											type: "box",
										},
										{
											layout: {
												padding: {
													base: { ...evenPadding(6), blockStart: "0" },
													compact: { ...evenPadding(8), blockStart: "0" },
													wide: wideEdges,
												},
											},
											props: {
												children: [
													{
														layout: {
															blockSize: "1.5rem",
															visibility: { base: "removed", wide: "visible" },
														},
														props: { children: [], direction: "row" },
														type: "flex",
													},
													{
														props: {
															children: [
																bannerTextNode({
																	appearance: "body-md",
																	pointer: "/copy/description",
																	tone: "muted",
																}),
																bannerButtonRow({}),
															],
															direction: "column",
															gap: "8sp",
														},
														type: "flex",
													},
												],
												direction: "column",
												gap: "4sp",
											},
											type: "flex",
										},
									],
									columns: { base: 1, wide: [{ fraction: 1 }, "auto", { fraction: 1 }] },
									fill: "canvas",
									foreground: "primary",
									radius: "theme",
								},
								type: "grid",
							},
						],
						direction: "column",
						justify: "end",
					},
					type: "flex",
				},
			],
			fill: "transparent",
		},
		type: "box",
	},
});
