import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerPadding,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerImage } from "./_shared/banner-image-parts";

export const bannerEditorialSplitSection = defineSection({
	category: "hero",
	pattern: "banner-editorial-split",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary", "secondary"],
			initial: 1,
			target: "/props/children/0/props/children/1/props/children/0/props/children/1/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport" },
		props: {
			children: [
				{
					layout: {
						...bannerContentLayout,
						minBlockSize: "viewport",
						padding: bannerPadding({ base: ["16sp", "16sp"], compact: ["20sp", "20sp"] }),
					},
					props: {
						children: [
							bannerTextNode({ appearance: "display-lg", element: "h1", pointer: "/copy/heading" }),
							{
								layout: { grow: 1 },
								props: {
									align: { base: "stretch", wide: "end" },
									children: [
										{
											layout: {
												inlineSize: { base: "full", wide: "50%" },
												padding: { base: { inlineEnd: "0" }, wide: { inlineEnd: "12sp" } },
											},
											props: {
												children: [
													bannerTextNode({
														appearance: "body-md",
														layout: { maxInlineSize: "28rem" },
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
										bannerImage({
											layout: {
												aspectRatio: { height: 3, width: 4 },
												inlineSize: { base: "full", wide: "50%" },
												maxInlineSize: "48rem",
												order: { base: -1, wide: 1 },
											},
										}),
									],
									direction: { base: "column", wide: "row" },
									gap: { base: "6sp", wide: "0" },
									justify: "end",
								},
								type: "flex",
							},
						],
						direction: "column",
						gap: "12sp",
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
