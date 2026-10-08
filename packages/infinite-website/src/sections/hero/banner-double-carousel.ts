import type { Layout, SiteNodeDefinition } from "../../document/structure-schema";
import type { SectionRepeater } from "../section-definition";
import { defineSection } from "../section-definition";
import {
	bannerActionsRepeater,
	bannerButtonRow,
	bannerContentLayout,
	bannerKicker,
	bannerTextNode,
} from "./_shared/banner-copy-parts";
import { bannerImage, sectionPadding } from "./_shared/banner-image-parts";

const imageRepeater = ({
	collection,
	initial,
	layout,
	target,
}: {
	collection: string;
	initial: number;
	layout: Parameters<typeof bannerImage>[0]["layout"];
	target: string;
}) => {
	return {
		collection,
		createValues: ({ index }) => [bannerImage({ assetPath: `${collection}/items/${index}`, layout })],
		initial,
		max: 8,
		min: 1,
		target,
	} satisfies SectionRepeater;
};

const columnItem = { aspectRatio: { height: 4, width: 3 }, inlineSize: "full", shrink: 0 } as const;

const rowItem = { aspectRatio: { height: 3, width: 4 }, blockSize: "40sp", shrink: 0 } as const;

const marqueeCarousel = ({
	axis,
	reverse = false,
	startIndex,
	viewportLayout,
}: {
	axis: "x" | "y";
	reverse?: boolean;
	startIndex?: number;
	viewportLayout?: Layout;
}) =>
	({
		layout: { shrink: 0 },
		props: {
			controlGroups: [],
			gap: "4sp",
			label: { $text: "/copy/heading" },
			marquee: { direction: reverse ? "backward" : "forward", speed: reverse ? 0.4 : 0.5 },
			options: { axis, draggable: false, loop: true, startIndex },
			slideBasis: "auto",
			slides: [],
			viewportLayout,
		},
		type: "carousel",
	}) satisfies SiteNodeDefinition;

const column = ({ reverse }: { reverse?: boolean }) =>
	marqueeCarousel({
		axis: "y",
		reverse,
		viewportLayout: { blockSize: "100vh", inlineSize: "72sp", margin: { inlineEnd: 0, inlineStart: 0 } },
	});

const row = ({ reverse }: { reverse?: boolean }) =>
	marqueeCarousel({
		axis: "x",
		reverse,
		startIndex: reverse ? 1 : undefined,
	});

export const bannerDoubleCarouselSection = defineSection({
	category: "hero",
	pattern: "banner-double-carousel",
	repeaters: [
		bannerActionsRepeater({
			appearances: ["primary", "outline"],
			initial: 1,
			target: "/props/children/0/props/children/0/props/children/2/props/children",
		}),
		imageRepeater({
			collection: "/leftItems",
			initial: 4,
			layout: columnItem,
			target: "/props/children/0/props/children/1/props/children/0/props/slides",
		}),
		imageRepeater({
			collection: "/rightItems",
			initial: 3,
			layout: columnItem,
			target: "/props/children/0/props/children/1/props/children/1/props/slides",
		}),
		bannerActionsRepeater({
			appearances: ["primary", "outline"],
			initial: 1,
			target: "/props/children/1/props/children/0/props/children/2/props/children",
		}),
		imageRepeater({
			collection: "/leftItems",
			initial: 4,
			layout: rowItem,
			target: "/props/children/1/props/children/1/props/children/0/props/slides",
		}),
		imageRepeater({
			collection: "/rightItems",
			initial: 3,
			layout: rowItem,
			target: "/props/children/1/props/children/1/props/children/1/props/slides",
		}),
	],
	root: {
		layout: { overflow: "hidden" },
		props: {
			children: [
				{
					layout: {
						...bannerContentLayout,
						padding: { base: { inlineEnd: "1.5rem", inlineStart: "1.5rem" } },
						visibility: { base: "removed", wide: "visible" },
					},
					props: {
						align: "center",
						children: [
							{
								layout: {
									inlineSize: "50%",
									padding: { blockEnd: "20sp", blockStart: "20sp" },
									shrink: 1,
								},
								props: {
									children: [
										{
											props: {
												children: [
													bannerKicker({}),
													bannerTextNode({
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
										bannerTextNode({
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
							{
								layout: {
									inlineSize: "50cqi",
									margin: { inlineEnd: "viewport-bleed-offset" },
									overflow: "hidden",
									shrink: 0,
								},
								props: {
									children: [column({}), column({ reverse: true })],
									direction: "row",
									gap: "4sp",
								},
								type: "flex",
							},
						],
						direction: "row",
						gap: "8sp",
					},
					type: "flex",
				},
				{
					layout: {
						...bannerContentLayout,
						padding: sectionPadding({ base: [12, 12], compact: [16, 16] }),
						visibility: { base: "visible", wide: "removed" },
					},
					props: {
						children: [
							{
								props: {
									align: "center",
									children: [
										{
											props: {
												align: "center",
												children: [
													bannerKicker({ align: "center" }),
													bannerTextNode({
														align: "center",
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
										bannerTextNode({
											align: "center",
											appearance: "body-lg",
											layout: { maxInlineSize: "36rem" },
											pointer: "/copy/description",
											tone: "muted",
										}),
										bannerButtonRow({ justify: "center" }),
									],
									direction: "column",
									gap: "8sp",
								},
								type: "flex",
							},
							{
								props: {
									children: [row({}), row({ reverse: true })],
									direction: "column",
									gap: "4sp",
								},
								type: "flex",
							},
						],
						direction: "column",
						gap: "8sp",
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
