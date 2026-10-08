import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { media, pad, sectionContent, sectionRoot, splitIntro, text } from "./_shared/durable-parts";

const tiles = [
	{ kind: "text", span: 2, start: 1 },
	{ kind: "text", span: 1, start: 3 },
	{ kind: "image", span: 1, start: 4 },
	{ kind: "image", span: 1, start: 1 },
	{ kind: "text", span: 1, start: 2 },
	{ kind: "text", span: 2, start: 3 },
	{ kind: "text", span: 1, start: 1 },
	{ kind: "text", span: 2, start: 2 },
	{ kind: "image", span: 1, start: 4 },
] as const;

const invertedIndex = 5;

const placement = ({ index, span, start }: { index: number; span: number; start: number }) => ({
	gridColumn: {
		base: { span: 1, start: 1 },
		compact: { span: 1, start: (index % 2) + 1 },
		wide: { span, start },
	},
	minBlockSize: "80sp",
});

const textTile = ({ index, order }: { index: number; order: number }): SiteNodeDefinition => ({
	layout: {
		...placement({ index, span: tiles[index].span, start: tiles[index].start }),
		padding: pad({ block: "6sp", inline: "6sp" }),
	},
	props: {
		children: [
			text({
				appearance: "label-lg",
				element: "span",
				pointer: `/features/items/${order}/number`,
				tone: "muted",
			}),
			{
				props: {
					children: [
						text({ appearance: "heading-sm", element: "h3", pointer: `/features/items/${order}/title` }),
						text({ appearance: "body-sm", pointer: `/features/items/${order}/description`, tone: "muted" }),
					],
					direction: "column",
					gap: "4sp",
				},
				type: "flex",
			},
		],
		direction: "column",
		fill: index === invertedIndex ? "featured" : "tint",
		justify: "between",
		radius: "theme",
	},
	type: "flex",
});

const imageTile = ({ index, order }: { index: number; order: number }) =>
	media({
		layout: placement({ index, span: tiles[index].span, start: tiles[index].start }),
		pointer: `/media/items/${order}`,
	});

const children = tiles.reduce<{ image: number; nodes: Array<SiteNodeDefinition>; text: number }>(
	(accumulator, tile, index) =>
		tile.kind === "text"
			? {
					...accumulator,
					nodes: [...accumulator.nodes, textTile({ index, order: accumulator.text })],
					text: accumulator.text + 1,
				}
			: {
					...accumulator,
					image: accumulator.image + 1,
					nodes: [...accumulator.nodes, imageTile({ index, order: accumulator.image })],
				},
	{ image: 0, nodes: [], text: 0 }
).nodes;

export const featureBentoGridSection = defineSection({
	category: "features",
	pattern: "feature-bento-grid",
	root: sectionRoot({
		children: [
			sectionContent({
				children: [
					splitIntro({ buttons: ["outline"] }),
					{
						props: {
							children,
							columns: { base: 1, compact: 2, wide: 4 },
							gap: "4sp",
						},
						type: "grid",
					},
				],
				gap: { base: "8sp", compact: "16sp" },
				padding: {
					base: pad({ block: "12sp", inline: "1.5rem" }),
					compact: pad({ block: "16sp", inline: "1.5rem" }),
				},
			}),
		],
	}),
});
