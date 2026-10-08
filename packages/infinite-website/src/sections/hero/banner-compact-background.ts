import { defineSection } from "../section-definition";
import { bannerButtonRow, bannerContentLayout, bannerTextNode } from "./_shared/banner-copy-parts";
import { bannerBackgroundImage, bannerSmallActionsRepeater, sectionPadding } from "./_shared/banner-image-parts";

export const bannerCompactBackgroundSection = defineSection({
	category: "hero",
	pattern: "banner-compact-background",
	repeaters: [
		bannerSmallActionsRepeater({
			appearances: ["primary", "secondary"],
			initial: 1,
			target: "/props/children/1/props/children/0/props/children/2/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport", position: "relative" },
		props: {
			children: [
				bannerBackgroundImage({
					overlay: {
						angle: 180,
						kind: "linear-gradient",
						stops: [
							{ opacity: 0.4, position: 0 },
							{ opacity: 0.4, position: 30 },
							{ opacity: 0.85, position: 100 },
						],
					},
				}),
				{
					layout: {
						...bannerContentLayout,
						grow: 1,
						minBlockSize: "viewport",
						padding: sectionPadding({ base: [20, 20], compact: [24, 24] }),
						position: "relative",
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
											appearance: "heading-sm",
											element: "h1",
											pointer: "/copy/heading",
											tone: "media",
										}),
										bannerTextNode({
											align: "center",
											appearance: "body-sm",
											layout: { maxInlineSize: "24rem" },
											pointer: "/copy/description",
											tone: "media",
										}),
										bannerButtonRow({ justify: "center" }),
									],
									direction: "column",
									gap: "4sp",
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
			fill: "transparent",
			foreground: "media",
		},
		type: "box",
	},
});
