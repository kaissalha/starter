import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerDivider,
	bannerKicker,
	bannerPadding,
	bannerTextNode,
} from "./_shared/banner-copy-parts";

export const bannerTextOnlySection = defineSection({
	category: "hero",
	pattern: "banner-text-only",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["outline", "secondary"],
			target: "/props/children/0/props/children/1/props/children/1/props/children/1/props/children",
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
						padding: bannerPadding({ base: ["20sp", "8sp"], compact: ["24sp", "16sp"] }),
					},
					props: {
						children: [
							{
								layout: { maxInlineSize: "64rem" },
								props: {
									children: [
										bannerKicker({}),
										bannerTextNode({
											appearance: "display-lg",
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
										bannerDivider({}),
										{
											props: {
												align: { base: "stretch", compact: "end" },
												children: [
													bannerTextNode({
														appearance: "body-lg",
														layout: { maxInlineSize: "42rem" },
														pointer: "/copy/description",
														tone: "muted",
													}),
													bannerButtonRow({ justify: "end" }),
												],
												columns: { base: 1, compact: 2 },
												gap: "4sp",
											},
											type: "grid",
										},
									],
									direction: "column",
									gap: "6sp",
								},
								type: "flex",
							},
						],
						direction: "column",
						gap: "28sp",
						justify: "between",
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
