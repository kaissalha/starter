import type { Layout, SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { box, buttonRow, flex, frameLayout, grid, kicker, pad, sectionBox, space, text } from "./_shared/parts";

const cellRule = ({ layout }: { layout: Layout }): SiteNodeDefinition =>
	box({
		decorative: true,
		fill: "border",
		layout: { position: "absolute", visibility: { base: "removed", wide: "visible" }, ...layout },
	});

const bottomRule = (): SiteNodeDefinition =>
	cellRule({ layout: { blockSize: 1, inset: { blockEnd: 0, inlineEnd: 0, inlineStart: 0 } } });

const sideRule = ({ side }: { side: "inlineEnd" | "inlineStart" }): SiteNodeDefinition =>
	cellRule({ layout: { inlineSize: 1, inset: { blockEnd: 0, blockStart: 0, [side]: 0 } } });

export const metricsEditorialSplitSection = defineSection({
	category: "metrics",
	pattern: "metrics-editorial-split",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					children: [
						text({ appearance: "display-sm", pointer: `/items/items/${index}/metric`, tone: "muted" }),
						flex({
							children: [
								text({ appearance: "body-md", pointer: `/items/items/${index}/title` }),
								text({
									appearance: "body-sm",
									pointer: `/items/items/${index}/description`,
									tone: "muted",
								}),
							],
							gap: space(2),
						}),
					],
					gap: space({ base: 4, wide: 8 }),
				}),
			],
			initial: 4,
			max: 5,
			min: 1,
			target: "/props/children/0/props/children/1/props/children/0/props/children",
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
									text({
										appearance: "display-sm",
										element: "h2",
										layout: { maxInlineSize: "36rem" },
										pointer: "/copy/heading",
									}),
								],
								gap: space(2),
							}),
							flex({
								children: [
									text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
									buttonRow({ appearances: ["secondary"] }),
								],
								gap: space(6),
								layout: { maxInlineSize: "36rem" },
							}),
							bottomRule(),
						],
						gap: space(12),
						justify: { base: "start", wide: "between" },
						layout: {
							padding: pad({
								bottom: { base: 16, compact: 20, wide: 16 },
								end: { base: 0, wide: 12 },
								top: { base: 16, compact: 20, wide: 16 },
							}),
							position: "relative",
						},
					}),
					flex({
						children: [
							flex({ children: [], gap: space(8) }),
							bottomRule(),
							sideRule({ side: "inlineStart" }),
							sideRule({ side: "inlineEnd" }),
						],
						layout: {
							padding: pad({
								bottom: { base: 16, compact: 20, wide: 16 },
								start: { base: 0, wide: 12 },
								top: { base: 0, wide: 16 },
							}),
							position: "relative",
						},
					}),
				],
				columns: { base: 1, wide: 2 },
				layout: frameLayout({ y: 0 }),
			}),
		],
	}),
});
