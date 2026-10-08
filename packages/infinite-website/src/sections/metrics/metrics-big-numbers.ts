import { defineSection } from "../section-definition";
import { flex, frameLayout, grid, kicker, sectionBox, space, text } from "./_shared/parts";

export const metricsBigNumbersSection = defineSection({
	category: "metrics",
	pattern: "metrics-big-numbers",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					children: [
						text({ appearance: "display-lg", pointer: `/items/items/${index}/metric` }),
						text({ appearance: "body-md", pointer: `/items/items/${index}/description`, tone: "muted" }),
					],
					gap: space(2),
				}),
			],
			initial: 4,
			max: 6,
			min: 2,
			target: "/props/children/0/props/children/1/props/children/0/props/children",
		},
	],
	root: sectionBox({
		children: [
			flex({
				children: [
					grid({
						align: "start",
						children: [
							kicker(),
							flex({
								children: [
									text({ appearance: "display-md", element: "h2", pointer: "/copy/heading" }),
									text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
								],
								gap: space(4),
								layout: {
									gridColumn: { base: { span: 1, start: 1 }, wide: { span: 1, start: 2 } },
									maxInlineSize: "48rem",
								},
							}),
						],
						columnGap: { base: "6sp", wide: 0 },
						columns: { base: 1, wide: ["232px", { fraction: 1 }] },
						rowGap: space(6),
					}),
					grid({
						children: [
							grid({
								children: [],
								columnGap: { base: 0, compact: "8sp" },
								columns: { base: 1, compact: 2 },
								layout: { gridColumn: { base: { span: 1, start: 1 }, wide: { span: 1, start: 2 } } },
								rowGap: space(8),
							}),
						],
						columns: { base: 1, wide: ["232px", { fraction: 1 }] },
					}),
				],
				gap: space(16),
				layout: frameLayout({ y: { base: 16, compact: 20 } }),
			}),
		],
	}),
});
