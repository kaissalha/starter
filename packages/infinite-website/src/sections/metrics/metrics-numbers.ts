import { defineSection } from "../section-definition";
import { flex, frameLayout, grid, horizontalDivider, kicker, pad, sectionBox, space, text } from "./_shared/parts";

export const metricsNumbersSection = defineSection({
	category: "metrics",
	pattern: "metrics-numbers",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					children: [
						flex({
							children: [text({ appearance: "heading-lg", pointer: `/items/items/${index}/metric` })],
							layout: { padding: pad({ x: 4, y: 4 }) },
						}),
						horizontalDivider(),
						text({ appearance: "body-md", pointer: `/items/items/${index}/label`, tone: "muted" }),
					],
					gap: space(4),
					layout: { padding: pad({ y: 6 }) },
				}),
			],
			initial: 4,
			max: 4,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionBox({
		children: [
			flex({
				children: [
					flex({
						children: [
							kicker(),
							flex({
								children: [
									text({ appearance: "display-sm", element: "h2", pointer: "/copy/heading" }),
									text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
								],
								gap: space(6),
							}),
						],
						gap: space(4),
						layout: { maxInlineSize: "36rem" },
					}),
					grid({ children: [], columns: { base: 1, compact: 2, wide: 4 }, gap: space(3) }),
				],
				gap: space({ base: 8, compact: 16 }),
				layout: frameLayout({ y: { base: 16, compact: 20 } }),
			}),
		],
	}),
});
