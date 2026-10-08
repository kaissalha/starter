import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerKicker,
	bannerPadding,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerBackgroundImage } from "./_shared/banner-image-parts";

export const bannerImageFullSplitSection = defineSection({
	category: "hero",
	pattern: "banner-image-full-split",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["secondary", "outline"],
			onMedia: true,
			target: "/props/children/2/props/children/0/props/children/1/props/children/1/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport", overflow: "hidden", position: "relative" },
		props: {
			children: [
				bannerBackgroundImage({ overlay: { kind: "scrim", strength: "medium" } }),
				{
					layout: {
						blockSize: "full",
						inlineSize: "full",
						inset: { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 },
						position: "absolute",
					},
					props: {
						background: {
							angle: 180,
							kind: "linear-gradient",
							stops: [
								{ color: "transparent", position: 21 },
								{ color: "black", opacity: 0.45, position: 48 },
								{ color: "black", opacity: 0.85, position: 100 },
							],
						},
						children: [],
						decorative: true,
					},
					type: "box",
				},
				{
					layout: {
						...bannerContentLayout,
						minBlockSize: "viewport",
						padding: bannerPadding({ base: ["12sp", "12sp"], compact: ["16sp", "16sp"] }),
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
												inlineSize: { base: "full", wide: "50%" },
												maxInlineSize: { base: "full", compact: "42rem" },
											},
											props: {
												children: [
													bannerKicker({ tone: "media" }),
													bannerTextNode({
														appearance: "display-md",
														element: "h1",
														pointer: "/copy/heading",
														tone: "media",
													}),
												],
												direction: "column",
												gap: "2sp",
											},
											type: "flex",
										},
										{
											layout: {
												inlineSize: { base: "full", wide: "50%" },
												maxInlineSize: { base: "full", compact: "32rem" },
												padding: { base: { blockStart: "0" }, wide: { blockStart: "13sp" } },
											},
											props: {
												children: [
													bannerTextNode({
														appearance: "body-md",
														pointer: "/copy/description",
														tone: "media",
													}),
													bannerButtonRow({}),
												],
												direction: "column",
												gap: "6sp",
											},
											type: "flex",
										},
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
