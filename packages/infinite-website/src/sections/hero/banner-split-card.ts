import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerPadding,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerBackgroundImage } from "./_shared/banner-image-parts";

export const bannerSplitCardSection = defineSection({
	category: "hero",
	pattern: "banner-split-card",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary", "secondary"],
			target: "/props/children/1/props/children/0/props/children/1/props/children/1/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport", overflow: "hidden", position: "relative" },
		props: {
			children: [
				bannerBackgroundImage({
					overlay: {
						angle: 180,
						kind: "linear-gradient",
						stops: [
							{ opacity: 0.25, position: 0 },
							{ opacity: 0.25, position: 50 },
							{ opacity: 0.85, position: 100 },
						],
					},
				}),
				{
					layout: {
						...bannerContentLayout,
						minBlockSize: "viewport",
						padding: bannerPadding({
							base: ["0sp", "6sp"],
							compact: ["0sp", "13sp"],
							wide: ["0sp", "16sp"],
						}),
						position: "relative",
					},
					props: {
						children: [
							{
								props: {
									align: { base: "stretch", wide: "end" },
									children: [
										{
											layout: {
												padding: { base: { inlineEnd: "0" }, wide: { inlineEnd: "8sp" } },
											},
											props: {
												children: [
													bannerTextNode({
														appearance: "display-md",
														element: "h1",
														layout: { maxInlineSize: "36rem" },
														pointer: "/copy/heading",
														tone: "media",
													}),
												],
											},
											type: "box",
										},
										{
											layout: {
												inlineSize: "full",
												maxInlineSize: { base: "full", compact: "36rem", wide: "full" },
												padding: {
													blockEnd: "6sp",
													blockStart: "6sp",
													inlineEnd: "6sp",
													inlineStart: "6sp",
												},
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
												fill: "canvas",
												foreground: "primary",
												gap: "6sp",
												radius: "theme",
											},
											type: "flex",
										},
									],
									columns: { base: 1, wide: 2 },
									gap: { base: "8sp", compact: "12sp", wide: "0" },
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
			fill: "subtle",
			foreground: "media",
		},
		type: "box",
	},
});
