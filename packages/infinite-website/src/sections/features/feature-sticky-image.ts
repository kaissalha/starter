import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { allEdges, divider, flex, grid, image, sectionBox, text } from "./_shared/section-parts";

const reveal = ({
	animation = "rise",
	children,
	delayMs = 0,
	layout,
}: {
	animation?: "rise" | "zoom";
	children: Array<SiteNodeDefinition>;
	delayMs?: number;
	layout?: SiteNodeDefinition["layout"];
}): SiteNodeDefinition => ({
	layout,
	props: { children, reveal: { animation, delayMs, durationMs: 700 } },
	type: "box",
});

export const featureStickyImageSection = defineSection({
	category: "features",
	pattern: "feature-sticky-image",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				reveal({
					children: [
						flex({
							children: [
								divider(),
								flex({
									children: [
										text({
											appearance: "body-md",
											element: "span",
											layout: { inlineSize: "4sp", shrink: 0 },
											pointer: `/items/items/${index}/number`,
											tone: "muted",
										}),
										flex({
											children: [
												text({
													appearance: "heading-sm",
													element: "h3",
													italic: true,
													pointer: `/items/items/${index}/title`,
												}),
												text({
													appearance: "body-sm",
													pointer: `/items/items/${index}/description`,
													tone: "muted",
												}),
											],
											gap: "2sp",
											layout: { grow: 1 },
										}),
									],
									direction: "row",
									gap: { base: "6sp", compact: "8sp" },
									layout: {
										padding: {
											base: {
												blockEnd: "8sp",
												blockStart: "8sp",
												inlineEnd: "6sp",
												inlineStart: "6sp",
											},
											compact: {
												blockEnd: "8sp",
												blockStart: "8sp",
												inlineEnd: "4sp",
												inlineStart: "4sp",
											},
										},
									},
								}),
							],
						}),
					],
				}),
			],
			initial: 4,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/children/1/props/children",
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
									reveal({
										children: [
											text({
												appearance: "heading-sm",
												element: "h2",
												layout: { maxInlineSize: "20rem" },
												pointer: "/copy/heading",
											}),
										],
									}),
									reveal({
										animation: "zoom",
										children: [
											image({
												aspectRatio: { height: 4, width: 3 },
												inlineSize: "full",
												pointer: "/media/items/0",
												radius: "none",
											}),
										],
										delayMs: 100,
										layout: { maxInlineSize: "20rem" },
									}),
								],
								gap: "8sp",
								layout: {
									inset: { blockStart: "18sp" },
									position: { base: "static", compact: "sticky" },
								},
							}),
						],
					}),
					flex({
						children: [
							text({
								appearance: "body-lg",
								layout: { maxInlineSize: "20rem", visibility: { base: "removed", compact: "hidden" } },
								pointer: "/copy/heading",
							}),
							flex({ children: [] }),
						],
						gap: "6sp",
					}),
				],
				columns: { base: 1, compact: 2 },
				gap: "8sp",
				layout: {
					inlineSize: "full",
					margin: { inlineEnd: "auto", inlineStart: "auto" },
					maxInlineSize: "96rem",
					padding: {
						base: { ...allEdges("1.5rem"), blockEnd: "20sp", blockStart: "20sp" },
						compact: { ...allEdges("1.5rem"), blockEnd: "24sp", blockStart: "24sp" },
					},
				},
			}),
		],
	}),
});
