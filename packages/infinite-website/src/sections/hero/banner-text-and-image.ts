import { defineSection } from "../section-definition";
import { bannerActionsRepeater, bannerButtonRow, bannerKicker, bannerTextNode } from "./_shared/banner-copy-parts";
import { bannerImage } from "./_shared/banner-image-parts";

export const bannerTextAndImageSection = defineSection({
	category: "hero",
	pattern: "banner-text-and-image",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary", "secondary"],
			initial: 1,
			target: "/props/children/0/props/children/0/props/children/0/props/children/1/props/children/1/props/children",
		}),
	],
	root: {
		layout: {},
		props: {
			children: [
				{
					props: {
						align: "stretch",
						children: [
							{
								layout: {
									padding: {
										base: {
											blockEnd: "0",
											blockStart: "12sp",
											inlineEnd: "1.5rem",
											inlineStart: "1.5rem",
										},
										compact: {
											blockEnd: "16sp",
											blockStart: "16sp",
											inlineEnd: "4sp",
											inlineStart: "1.5rem",
										},
									},
								},
								props: {
									align: "start",
									children: [
										{
											layout: { inlineSize: "full", maxInlineSize: "36rem" },
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
															],
															direction: "column",
															gap: "2sp",
														},
														type: "flex",
													},
													{
														props: {
															children: [
																bannerTextNode({
																	appearance: "body-lg",
																	pointer: "/copy/description",
																	tone: "muted",
																}),
																bannerButtonRow({}),
															],
															direction: "column",
															gap: "6sp",
														},
														type: "flex",
													},
												],
												direction: "column",
												gap: "6sp",
											},
											type: "flex",
										},
									],
									direction: "column",
									justify: "center",
								},
								type: "flex",
							},
							{
								layout: {
									blockSize: { base: "72sp", compact: "auto" },
									margin: {
										base: { inlineEnd: "1.5rem", inlineStart: "1.5rem" },
										compact: { inlineEnd: "0", inlineStart: "0" },
									},
									overflow: "hidden",
									position: "relative",
								},
								props: {
									children: [
										bannerImage({
											layout: {
												blockSize: "full",
												inlineSize: "full",
												inset: { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 },
												position: "absolute",
											},
											radius: "none",
										}),
									],
								},
								type: "box",
							},
						],
						columns: { base: 1, compact: 2 },
						gap: { base: "8sp", compact: "0" },
					},
					type: "grid",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
