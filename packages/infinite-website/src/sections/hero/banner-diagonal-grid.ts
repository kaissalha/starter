import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerBackgroundImage, sectionPadding } from "./_shared/banner-image-parts";

export const bannerDiagonalGridSection = defineSection({
	category: "hero",
	pattern: "banner-diagonal-grid",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary"],
			target: "/props/children/0/props/children/1/props/children/0/props/children/1/props/children",
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
							bannerTextNode({
								appearance: "display-md",
								element: "h1",
								layout: {
									maxInlineSize: { base: "full", compact: "75%" },
									padding: { blockEnd: "8sp" },
								},
								pointer: "/copy/heading",
							}),
							{
								props: {
									children: [
										{
											layout: {
												gridColumn: {
													base: { span: 4, start: 1 },
													compact: { span: 2, start: 1 },
													wide: { span: 1, start: 1 },
												},
												gridRow: { base: { span: 1, start: 1 } },
											},
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
												gap: "6sp",
											},
											type: "flex",
										},
										{
											layout: {
												gridColumn: {
													base: { span: 3, start: 2 },
													wide: { span: 2, start: 3 },
												},
												gridRow: {
													base: { span: 1, start: 3 },
													compact: { span: 2, start: 2 },
													wide: { span: 3, start: 1 },
												},
												overflow: "hidden",
												position: "relative",
											},
											props: {
												children: [bannerBackgroundImage({ assetPath: "/media/items/1" })],
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
												gridRow: { base: { span: 1, start: 4 } },
												overflow: "hidden",
												position: "relative",
											},
											props: {
												children: [bannerBackgroundImage({ assetPath: "/media/items/0" })],
												radius: "theme",
											},
											type: "box",
										},
									],
									columns: 4,
									rows: 4,
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
