import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerKicker,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerImageTile, sectionPadding } from "./_shared/banner-image-parts";

const description = () => {
	const node = bannerTextNode({
		appearance: "body-md",
		layout: { maxInlineSize: "28rem" },
		pointer: "/copy/description",
		tone: "muted",
	});

	return {
		...node,
		props: { ...node.props, align: { base: "center", compact: "start" } },
	} satisfies SiteNodeDefinition;
};

export const bannerDoubleImageBottomSection = defineSection({
	category: "hero",
	pattern: "banner-double-image-bottom",
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
						padding: sectionPadding({ base: [16, 16], compact: [20, 20] }),
					},
					props: {
						children: [
							{
								layout: { padding: { blockEnd: "12sp" } },
								props: {
									align: "center",
									children: [
										bannerKicker({ align: "center" }),
										bannerTextNode({
											align: "center",
											appearance: "display-lg",
											element: "h1",
											layout: { maxInlineSize: "48rem" },
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
									align: "end",
									children: [
										{
											layout: {
												gridColumn: {
													base: { span: 5, start: 1 },
													compact: { span: 2, start: 1 },
													wide: { span: 1, start: 1 },
												},
												gridRow: {
													base: { span: 1, start: 1 },
													compact: { span: 2, start: 1 },
												},
											},
											props: {
												align: { base: "center", compact: "start" },
												children: [description(), bannerButtonRow({})],
												direction: "column",
												gap: "6sp",
											},
											type: "flex",
										},
										bannerImageTile({
											assetPath: "/media/items/0",
											layout: {
												aspectRatio: { height: 1, width: 1 },
												gridColumn: {
													base: { span: 2, start: 1 },
													compact: { span: 1, start: 3 },
													wide: { span: 1, start: 2 },
												},
												gridRow: {
													base: { span: 1, start: 2 },
													compact: { span: 2, start: 1 },
												},
												inlineSize: "full",
												margin: { base: {}, compact: { inlineStart: "auto" } },
												maxInlineSize: { base: "full", compact: "24sp" },
											},
										}),
										bannerImageTile({
											assetPath: "/media/items/1",
											layout: {
												aspectRatio: {
													base: { height: 2, width: 3 },
													compact: { height: 1, width: 1 },
													wide: { height: 3, width: 4 },
												},
												gridColumn: {
													base: { span: 3, start: 3 },
													compact: { span: 2, start: 4 },
												},
												gridRow: {
													base: { span: 1, start: 2 },
													compact: { span: 2, start: 1 },
												},
											},
										}),
									],
									columns: 5,
									rowGap: "10sp",
									rows: { base: ["auto", "auto"], compact: 2 },
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
