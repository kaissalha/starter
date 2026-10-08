import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { flex, frameLayout, grid, kicker, pad, sectionBox, space, text } from "./_shared/parts";

const card = ({ index }: { index: number }): SiteNodeDefinition =>
	flex({
		children: [
			text({ appearance: "heading-lg", pointer: `/items/items/${index}/metric` }),
			text({ appearance: "title-md", element: "h3", pointer: `/items/items/${index}/title` }),
		],
		fill: "tint",
		justify: "between",
		layout: {
			...(index % 2 === 0 && { minBlockSize: { base: 0, compact: "43sp" } }),
			padding: pad({ x: { base: 6, compact: 8 }, y: { base: 6, compact: 8 } }),
		},
		radius: "theme",
	});

export const metricsCardGridSection = defineSection({
	category: "metrics",
	pattern: "metrics-card-grid",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [card({ index })],
			initial: 4,
			max: 6,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionBox({
		children: [
			grid({
				children: [
					flex({
						children: [
							flex({
								children: [
									kicker(),
									text({ appearance: "display-sm", element: "h2", pointer: "/copy/heading" }),
								],
								gap: space(4),
							}),
							text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
						],
						gap: space(6),
					}),
					{
						props: { children: [], columns: { base: 1, compact: 2 }, gap: space(4) },
						type: "masonry",
					},
				],
				columns: { base: 1, wide: [{ fraction: 480 }, { fraction: 680 }] },
				gap: space(8),
				layout: frameLayout({ y: { base: 16, compact: 20 } }),
			}),
		],
	}),
});
