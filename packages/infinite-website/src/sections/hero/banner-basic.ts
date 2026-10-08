import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { sectionPadding } from "./_shared/banner-image-parts";

export const bannerBasicSection = defineSection({
	category: "hero",
	pattern: "banner-basic",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary"],
			target: "/props/children/0/props/children/0/props/children/1/props/children/1/props/children",
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
						align: "center",
						children: [
							{
								props: {
									align: "center",
									children: [
										bannerTextNode({
											align: "center",
											appearance: "display-lg",
											element: "h1",
											layout: { maxInlineSize: "48rem" },
											pointer: "/copy/heading",
										}),
										{
											layout: { maxInlineSize: "32rem" },
											props: {
												align: "center",
												children: [
													bannerTextNode({
														align: "center",
														appearance: "body-lg",
														pointer: "/copy/description",
														tone: "muted",
													}),
													bannerButtonRow({ justify: "center" }),
												],
												direction: "column",
												gap: "8sp",
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
			],
			fill: "canvas",
		},
		type: "box",
	},
});
