import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { blockEdges, contentFrame, divider, flex, grid, image, sectionBox, text } from "./_shared/section-parts";

const inset = { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 } as const;

const hiddenDivider: SiteNodeDefinition = {
	layout: { blockSize: 1, inlineSize: "full" },
	props: { children: [], decorative: true, fill: "transparent" },
	type: "box",
};

const content = ({ hidden, index }: { hidden: boolean; index: number }): SiteNodeDefinition => {
	const rule = hidden ? hiddenDivider : divider({ fill: "current" });

	return contentFrame({
		children: [
			...(index > 0 ? [rule] : []),
			grid({
				align: "center",
				children: [
					text({ appearance: "display-md", element: "h3", pointer: `/items/items/${index}/title` }),
					text({
						appearance: "body-md",
						pointer: `/items/items/${index}/description`,
						tone: hidden ? "current" : "muted",
					}),
				],
				columns: { base: 1, compact: 2 },
				gap: "4sp",
				layout: { padding: { base: blockEdges("10sp") } },
			}),
		],
	});
};

export const featureListBackgroundImageSection = defineSection({
	category: "features",
	pattern: "feature-list-background-image",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				{
					props: {
						children: [content({ hidden: false, index })],
						hoverReveal: {
							backdrop: [
								image({
									layout: { inset, position: "absolute" },
									overlay: { kind: "scrim", strength: "strong" },
									pointer: `/items/items/${index}`,
									radius: "none",
								}),
							],
							cover: { fill: "canvas" },
							replacement: [content({ hidden: true, index })],
						},
					},
					type: "box",
				},
			],
			initial: 4,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionBox({
		children: [
			flex({
				children: [
					contentFrame({
						children: [
							text({
								appearance: "display-lg",
								element: "h2",
								layout: { maxInlineSize: "48rem" },
								pointer: "/copy/heading",
							}),
							text({
								appearance: "body-md",
								layout: { maxInlineSize: "48rem" },
								pointer: "/copy/description",
								tone: "muted",
							}),
						],
						gap: "4sp",
					}),
					flex({ children: [] }),
				],
				gap: "8sp",
				layout: { padding: { base: blockEdges("12sp"), compact: blockEdges("16sp") } },
			}),
		],
	}),
});
