import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerImage } from "./_shared/banner-image-parts";

export const bannerOversizedParallaxSection = defineSection({
	category: "hero",
	pattern: "banner-oversized-parallax",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary", "secondary"],
			initial: 1,
			target: "/props/children/1/props/children/0/props/children/1/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport", position: "relative" },
		props: {
			children: [
				bannerImage({
					imageOpacity: 0.25,
					layout: {
						inset: {
							base: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" },
							compact: { blockEnd: "12sp", blockStart: "12sp", inlineEnd: "12sp", inlineStart: "12sp" },
						},
						position: "absolute",
					},
					radius: "none",
				}),
				{
					layout: {
						...bannerContentLayout,
						grow: 1,
						minBlockSize: "viewport",
						padding: {
							base: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "6sp", inlineStart: "6sp" },
							compact: { blockEnd: "10sp", blockStart: "10sp", inlineEnd: "12sp", inlineStart: "12sp" },
							wide: { blockEnd: "10sp", blockStart: "10sp", inlineEnd: "6sp", inlineStart: "6sp" },
						},
						position: "relative",
						zIndex: 10,
					},
					props: {
						align: "center",
						children: [
							{
								layout: {
									padding: {
										base: { blockEnd: "8sp", blockStart: "8sp" },
										compact: { blockEnd: "10sp", blockStart: "10sp" },
									},
								},
								props: {
									align: "center",
									children: [
										{
											props: {
												align: "center",
												children: [
													bannerTextNode({
														align: "center",
														appearance: "display-xl",
														element: "h1",
														pointer: "/copy/heading",
													}),
													bannerTextNode({
														align: "center",
														appearance: "body-md",
														layout: { maxInlineSize: "28rem" },
														pointer: "/copy/description",
														tone: "muted",
													}),
												],
												direction: "column",
												gap: "4sp",
											},
											type: "flex",
										},
										bannerButtonRow({ justify: "center" }),
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
			],
			fill: "canvas",
		},
		type: "box",
	},
});
