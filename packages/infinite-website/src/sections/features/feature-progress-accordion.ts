import type { TabDecoration } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { allEdges, button, contentFrame, flex, image, kicker, sectionBox, text } from "./_shared/section-parts";

const edge = { blockSize: "1px", inlineSize: "full" } as const;

const decorations: Array<TabDecoration> = [
	{
		appearance: { fill: "border" },
		kind: "fill",
		layout: { ...edge, inset: { blockStart: 0, inlineStart: 0 } },
		source: "static",
	},
	{
		appearance: { fill: "border" },
		kind: "fill",
		layout: { ...edge, inset: { blockEnd: 0, inlineStart: 0 } },
		scope: "last",
		source: "static",
	},
	{
		appearance: { fill: "accent" },
		axis: "inline",
		kind: "fill",
		layout: { ...edge, inset: { blockEnd: 0, inlineStart: 0 } },
		source: "timer",
	},
];

export const featureProgressAccordionSection = defineSection({
	category: "features",
	pattern: "feature-progress-accordion",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				{
					detail: [
						text({
							appearance: "body-sm",
							layout: {
								maxInlineSize: "36rem",
								padding: { base: { blockStart: "6sp" }, wide: { blockStart: "4sp" } },
							},
							pointer: `/items/items/${index}/description`,
							tone: "muted",
						}),
						image({
							blockSize: "60sp",
							inlineSize: "full",
							layout: { margin: { blockStart: "6sp" }, visibility: { base: "visible", wide: "removed" } },
							pointer: `/items/items/${index}`,
						}),
					],
					panel: [
						image({
							blockSize: { base: "80sp", wide: "96sp" },
							inlineSize: "full",
							pointer: `/items/items/${index}`,
						}),
					],
					trigger: [
						flex({
							children: [
								text({
									appearance: "body-md",
									element: "span",
									layout: { shrink: 0 },
									pointer: `/items/items/${index}/number`,
									tone: "accent-text",
								}),
								text({
									appearance: "body-md",
									element: "span",
									pointer: `/items/items/${index}/title`,
								}),
							],
							direction: "row",
							gap: "2sp",
						}),
					],
					value: String(index),
				},
			],
			initial: 4,
			max: 6,
			min: 2,
			target: "/props/children/0/props/children/1/props/items",
		},
	],
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					flex({
						align: "start",
						children: [
							kicker({ tone: "accent-text" }),
							text({ appearance: "display-sm", element: "h2", pointer: "/copy/heading" }),
							button({ index: 0 }),
						],
						gap: "4sp",
					}),
					{
						props: {
							activateOnFocus: true,
							arrangement: { columns: { base: 1, wide: 2 }, gap: { base: "8sp", wide: 0 } },
							autoplay: { intervalMs: 5000 },
							crossfadeMs: 300,
							decorations,
							indicator: false,
							itemLayout: {
								padding: { base: allEdges("6sp"), wide: allEdges("4sp") },
							},
							items: [],
							label: { $text: "/accessibility/carouselLabel" },
							listLayout: { minBlockSize: "64sp" },
							orientation: "vertical",
							panels: "crossfade",
							panelsLayout: { visibility: { base: "removed", compact: "visible" } },
						},
						type: "tabs",
					},
				],
				gap: "12sp",
				padding: { base: "12sp", compact: "16sp" },
			}),
		],
	}),
});
