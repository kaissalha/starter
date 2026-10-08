import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerKicker,
	bannerPadding,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerImage } from "./_shared/banner-image-parts";

const centered = { base: "center", wide: "start" } as const;

const gridImage = ({ index }: { index: number }) => {
	return bannerImage({
		assetPath: `/media/items/${index}`,
		layout: {
			blockSize: "72sp",
			inlineSize: "full",
			...(index === 2 && { gridColumn: { base: { span: 1, start: 1 }, compact: { span: 2, start: 1 } } }),
		},
	});
};

export const bannerGridSection = defineSection({
	category: "hero",
	pattern: "banner-grid",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary"],
			target: "/props/children/0/props/children/0/props/children/1/props/children/1/props/children",
		}),
	],
	root: {
		layout: {},
		props: {
			children: [
				{
					layout: {
						...bannerContentLayout,
						padding: bannerPadding({ base: ["16sp", "16sp"], compact: ["20sp", "20sp"] }),
					},
					props: {
						align: { base: "stretch", wide: "center" },
						children: [
							{
								props: {
									align: { base: "center", wide: "start" },
									children: [
										{
											props: {
												children: [
													bannerKicker({ align: centered }),
													bannerTextNode({
														align: centered,
														appearance: "display-sm",
														element: "h1",
														layout: { maxInlineSize: "42rem" },
														pointer: "/copy/heading",
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
														align: centered,
														appearance: "body-lg",
														layout: { maxInlineSize: "36rem" },
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
									],
									direction: "column",
									gap: "6sp",
								},
								type: "flex",
							},
							{
								props: {
									children: [0, 1, 2].map((index) => gridImage({ index })),
									columns: { base: 1, compact: 2 },
									gap: "3sp",
								},
								type: "grid",
							},
						],
						columns: { base: 1, wide: 2 },
						gap: { base: "8sp", compact: "16sp" },
					},
					type: "grid",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
