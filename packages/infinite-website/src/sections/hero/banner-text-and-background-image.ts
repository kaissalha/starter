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

export const bannerTextAndBackgroundImageSection = defineSection({
	category: "hero",
	pattern: "banner-text-and-background-image",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary", "secondary"],
			initial: 1,
			onMedia: true,
			target: "/props/children/1/props/children/0/props/children/1/props/children/1/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport", overflow: "hidden", position: "relative" },
		props: {
			children: [
				bannerBackgroundImage({
					overlay: {
						angle: 281,
						kind: "linear-gradient",
						stops: [
							{ opacity: 0.25, position: 25 },
							{ opacity: 0.6, position: 50 },
							{ opacity: 0.9, position: 90 },
						],
					},
				}),
				{
					layout: {
						...bannerContentLayout,
						minBlockSize: "viewport",
						padding: bannerPadding({ base: ["20sp", "20sp"], compact: ["24sp", "24sp"] }),
						position: "relative",
					},
					props: {
						children: [
							{
								layout: { inlineSize: "full", maxInlineSize: "42rem" },
								props: {
									children: [
										{
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
												gap: "4sp",
											},
											type: "flex",
										},
										{
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
			fill: "subtle",
			foreground: "media",
		},
		type: "box",
	},
});
