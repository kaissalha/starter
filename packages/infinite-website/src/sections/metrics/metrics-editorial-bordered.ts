import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import {
	box,
	buttonRow,
	flex,
	frameLayout,
	grid,
	horizontalDivider,
	pad,
	sectionBox,
	space,
	text,
} from "./_shared/parts";

const band = (): SiteNodeDefinition =>
	box({
		decorative: true,
		fill: "tint",
		layout: { blockSize: { base: "12sp", wide: "16sp" }, inlineSize: "full", shrink: 0 },
		pattern: "diagonal-slash",
	});

export const metricsEditorialBorderedSection = defineSection({
	category: "metrics",
	pattern: "metrics-editorial-bordered",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					border: { color: "border", sides: ["block-start"], width: 1 },
					children: [
						flex({
							children: [
								text({ appearance: "heading-md", pointer: `/items/items/${index}/metric` }),
								text({
									appearance: "heading-md",
									pointer: `/items/items/${index}/title`,
									tone: "muted",
								}),
							],
						}),
						text({ appearance: "body-sm", pointer: `/items/items/${index}/description`, tone: "muted" }),
					],
					gap: space({ base: 3, compact: 2 }),
					layout: { padding: pad({ x: { base: 6, compact: 8 }, y: { base: 6, compact: 8 } }) },
				}),
			],
			initial: 4,
			max: 5,
			min: 2,
			target: "/props/children/1/props/children/1/props/children/1/props/children",
		},
	],
	root: sectionBox({
		children: [
			horizontalDivider(),
			grid({
				children: [
					flex({
						children: [
							text({
								appearance: "heading-sm",
								element: "h2",
								layout: { maxInlineSize: "36rem" },
								pointer: "/copy/heading",
							}),
							flex({
								children: [
									text({
										appearance: "body-md",
										layout: { maxInlineSize: "36rem" },
										pointer: "/copy/description",
										tone: "muted",
									}),
									buttonRow({ appearances: ["secondary"] }),
								],
								gap: space(8),
							}),
						],
						gap: space(2),
						justify: { base: "start", wide: "between" },
						layout: {
							padding: pad({
								bottom: { base: 0, wide: 16 },
								end: { base: 0, wide: 12 },
								start: 0,
								top: { base: 12, compact: 16, wide: 16 },
							}),
						},
					}),
					flex({
						border: { color: "border", sides: ["inline-start", "inline-end"], width: 1 },
						children: [band(), flex({ children: [] }), horizontalDivider(), band()],
					}),
				],
				columns: { base: 1, wide: 2 },
				gap: { base: "12sp", compact: "10sp", wide: 0 },
				layout: frameLayout({ y: 0 }),
			}),
			horizontalDivider(),
		],
	}),
});
