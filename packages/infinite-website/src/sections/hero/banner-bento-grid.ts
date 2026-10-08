import { defineSection } from "../section-definition";
import { bannerButtonRow, bannerContentLayout, bannerTextNode } from "./_shared/banner-copy-parts";
import { bannerImage, evenPadding, sectionPadding, bannerStretchActionsRepeater } from "./_shared/banner-image-parts";

export const bannerBentoGridSection = defineSection({
	category: "hero",
	pattern: "banner-bento-grid",
	repeaters: [
		bannerStretchActionsRepeater({
			appearances: ["primary"],
			target: "/props/children/0/props/children/0/props/children/1/props/children/0/props/children/1/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport" },
		props: {
			children: [
				{
					layout: {
						...bannerContentLayout,
						grow: 1,
						minBlockSize: "viewport",
						padding: sectionPadding({ base: [12, 12], compact: [16, 16] }),
					},
					props: {
						children: [
							{
								layout: { grow: 1 },
								props: {
									children: [
										bannerImage({
											layout: {
												aspectRatio: {
													base: { height: 3, width: 4 },
													compact: { height: 9, width: 16 },
												},
												gridColumn: { base: { span: 1, start: 1 } },
												gridRow: { base: { span: 1, start: 1 } },
												inlineSize: "full",
												minBlockSize: 220,
												visibility: { base: "visible", wide: "removed" },
											},
										}),
										{
											layout: {
												gridColumn: { base: { span: 1, start: 1 } },
												gridRow: { base: { span: 1, start: 2 }, wide: { span: 1, start: 1 } },
											},
											props: {
												children: [
													{
														layout: {
															blockSize: "full",
															padding: { base: evenPadding(6), compact: evenPadding(8) },
														},
														props: {
															children: [
																{
																	props: {
																		children: [
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
															justify: "end",
														},
														type: "flex",
													},
												],
												fill: "tint",
												foreground: "primary",
												radius: "theme",
											},
											type: "box",
										},
										{
											layout: {
												gridColumn: {
													base: { span: 1, start: 1 },
													wide: { span: 1, start: 2 },
												},
												gridRow: { base: { span: 1, start: 1 } },
												position: "relative",
												visibility: { base: "removed", wide: "visible" },
											},
											props: {
												children: [
													bannerImage({ layout: { blockSize: "full", inlineSize: "full" } }),
													{
														layout: {
															blockSize: "53%",
															inlineSize: "38%",
															inset: { blockEnd: 0, inlineEnd: 0 },
															padding: { blockStart: "6sp", inlineStart: "6sp" },
															position: "absolute",
														},
														props: {
															children: [
																bannerImage({
																	assetPath: "/media/items/1",
																	layout: { blockSize: "full", inlineSize: "full" },
																}),
															],
															fill: "canvas",
															radius: "theme",
														},
														type: "box",
													},
												],
											},
											type: "box",
										},
									],
									columns: { base: 1, wide: ["35%", { fraction: 1 }] },
									gap: "6sp",
									rows: { base: [{ fraction: 1 }, "auto"], wide: 1 },
								},
								type: "grid",
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
