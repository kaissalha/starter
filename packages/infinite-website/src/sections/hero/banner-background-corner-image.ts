import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerBackgroundImage, bannerImage, sectionPadding } from "./_shared/banner-image-parts";

const heading = () => {
	const node = bannerTextNode({
		appearance: "display-lg",
		element: "h1",
		pointer: "/copy/heading",
		tone: "media",
	});

	return {
		...node,
		props: { ...node.props, align: { base: "start", compact: "center" } },
	} satisfies SiteNodeDefinition;
};

export const bannerBackgroundCornerImageSection = defineSection({
	category: "hero",
	pattern: "banner-background-corner-image",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary", "secondary"],
			initial: 1,
			onMedia: true,
			target: "/props/children/1/props/children/1/props/children/0/props/children/1/props/children",
		}),
	],
	root: {
		layout: { minBlockSize: "viewport", position: "relative" },
		props: {
			children: [
				bannerBackgroundImage({ overlay: { kind: "scrim", strength: "strong" } }),
				{
					layout: {
						...bannerContentLayout,
						grow: 1,
						minBlockSize: "viewport",
						padding: sectionPadding({ base: [8, 8], compact: [10, 10] }),
						position: "relative",
					},
					props: {
						children: [
							{
								layout: {
									gridColumn: {
										base: { span: 1, start: 1 },
										compact: { span: 5, start: 1 },
										wide: { span: 3, start: 2 },
									},
									gridRow: {
										base: { span: 1, start: 1 },
										compact: { span: 1, start: 2 },
										wide: { span: 2, start: 4 },
									},
								},
								props: {
									children: [heading()],
									direction: "column",
									justify: { base: "start", compact: "end", wide: "center" },
								},
								type: "flex",
							},
							{
								layout: {
									gridColumn: {
										base: { span: 1, start: 1 },
										compact: { span: 2, start: 4 },
									},
									gridRow: {
										base: { span: 1, start: 2 },
										compact: { span: 1, start: 1 },
										wide: { span: 2, start: 2 },
									},
								},
								props: {
									children: [
										{
											layout: { maxInlineSize: "28rem" },
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
												gap: "4sp",
											},
											type: "flex",
										},
									],
									direction: "column",
									justify: "start",
								},
								type: "flex",
							},
							{
								layout: {
									gridColumn: { base: { span: 1, start: 1 } },
									gridRow: {
										base: { span: 1, start: 3 },
										compact: { span: 1, start: 3 },
										wide: { span: 1, start: 5 },
									},
								},
								props: {
									children: [
										bannerImage({
											assetPath: "/media/items/1",
											layout: { blockSize: "32sp", inlineSize: "32sp" },
										}),
									],
									direction: "column",
									justify: "end",
								},
								type: "flex",
							},
						],
						columns: { base: 1, compact: 5 },
						gap: { base: "6sp", compact: "0" },
						rows: { base: ["auto", "auto", { fraction: 1 }], compact: 3, wide: 5 },
					},
					type: "grid",
				},
			],
			fill: "transparent",
			foreground: "media",
		},
		type: "box",
	},
});
