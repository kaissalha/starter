import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerPadding,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerBackgroundImage } from "./_shared/banner-image-parts";

export const bannerFullImageSection = defineSection({
	category: "hero",
	pattern: "banner-full-image",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary", "secondary"],
			onMedia: true,
			target: "/props/children/1/props/children/0/props/children/1/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport", overflow: "hidden", position: "relative" },
		props: {
			children: [
				bannerBackgroundImage({ overlay: { kind: "scrim", strength: "medium" } }),
				{
					layout: {
						...bannerContentLayout,
						minBlockSize: "viewport",
						padding: bannerPadding({ base: ["16sp", "16sp"], compact: ["20sp", "20sp"] }),
						position: "relative",
					},
					props: {
						children: [
							{
								props: {
									align: { base: "stretch", wide: "end" },
									children: [
										{
											layout: { maxInlineSize: "42rem" },
											props: {
												children: [
													bannerTextNode({
														appearance: "display-md",
														element: "h1",
														pointer: "/copy/heading",
														tone: "media",
													}),
												],
												direction: "column",
												gap: "4sp",
											},
											type: "flex",
										},
										bannerButtonRow({}),
									],
									direction: { base: "column", wide: "row" },
									gap: "6sp",
									justify: "between",
								},
								type: "flex",
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
