import type { Layout, SiteNodeDefinition } from "../../document/structure-schema";
import { contentFrame, flex, grid, kicker, media, sectionBox, text } from "../gallery/_shared/section-parts";
import { defineSection } from "../section-definition";

const logo = ({ align, index }: { align: "center" | "start"; index: number }) =>
	media({
		fill: "transparent",
		fit: "contain",
		layout: { blockSize: "10sp", inlineSize: "full" },
		objectAlign: align,
		pointer: `/items/items/${index}`,
		radius: "none",
	});

const logoCard = ({ index, layout }: { index: number; layout?: Layout }): SiteNodeDefinition => ({
	layout: {
		padding: { base: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" } },
		...layout,
	},
	props: {
		align: "center",
		children: [logo({ align: "center", index })],
		direction: "column",
		fill: "tint",
		justify: "center",
		radius: "theme",
	},
	type: "flex",
});

const statCard = ({ index, layout }: { index: number; layout?: Layout }): SiteNodeDefinition => ({
	layout: {
		padding: { base: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" } },
		...layout,
	},
	props: {
		border: { color: "border", width: 1 },
		children: [
			logo({ align: "start", index }),
			flex({
				children: [
					text({ appearance: "title-lg", pointer: `/items/items/${index}/stat`, tone: "primary" }),
					text({ appearance: "body-md", pointer: `/items/items/${index}/label`, tone: "muted" }),
				],
				gap: "2sp",
			}),
		],
		direction: "column",
		fill: "canvas",
		gap: "16sp",
		justify: "between",
		radius: "theme",
	},
	type: "flex",
});

const kinds = ["logo", "stat", "stat", "logo", "logo", "stat", "stat", "logo"] as const;

const tablet = [
	[1, 1, 1],
	[2, 1, 3],
	[1, 2, 3],
	[2, 4, 1],
	[1, 5, 1],
	[2, 5, 3],
	[1, 6, 3],
	[2, 8, 1],
] as const;

const card = ({ index, layout }: { index: number; layout?: Layout }) =>
	kinds[index] === "stat" ? statCard({ index, layout }) : logoCard({ index, layout });

export const showcaseBentoCardsSection = defineSection({
	category: "showcase",
	pattern: "showcase-bento-cards",
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					flex({
						children: [
							kicker(),
							flex({
								children: [
									text({
										appearance: "display-sm",
										element: "h2",
										layout: { maxInlineSize: "36rem" },
										pointer: "/copy/heading",
										tone: "primary",
									}),
									text({
										appearance: "body-md",
										layout: { maxInlineSize: "42rem" },
										pointer: "/copy/description",
										tone: "muted",
									}),
								],
								gap: "4sp",
							}),
						],
						gap: "2sp",
					}),
					grid({
						children: tablet.map(([column, row, span], index) =>
							card({
								index,
								layout: {
									gridColumn: { base: { span: 1, start: 1 }, compact: { span: 1, start: column } },
									gridRow: { base: { span: 1, start: index + 1 }, compact: { span, start: row } },
								},
							})
						),
						columns: { base: 1, compact: 2 },
						gap: "4sp",
						layout: { visibility: { base: "visible", wide: "removed" } },
					}),
					grid({
						children: [0, 2, 4, 6].map((first) =>
							flex({
								children: [first, first + 1].map((index) =>
									card({ index, layout: { grow: kinds[index] === "stat" ? 3 : 1 } })
								),
								gap: "4sp",
							})
						),
						columns: 4,
						gap: "4sp",
						layout: { visibility: { base: "removed", wide: "visible" } },
					}),
				],
				gap: "16sp",
				padding: { base: "16sp", compact: "20sp" },
			}),
		],
	}),
});
