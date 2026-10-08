import { contentFrame, flex, grid, kicker, mediaAt, sectionBox, text } from "../gallery/_shared/section-parts";
import { defineSection } from "../section-definition";

export const showcaseGridHighlightSection = defineSection({
	category: "showcase",
	pattern: "showcase-grid-highlight",
	repeaters: [
		{
			collection: "/media",
			createValues: ({ index }) => [
				flex({
					align: "center",
					children: [
						mediaAt({
							fill: "transparent",
							fit: "contain",
							index,
							layout: { blockSize: "full", inlineSize: "full" },
							radius: "none",
						}),
					],
					fill: "tint",
					justify: "center",
					layout: {
						aspectRatio: { height: 1, width: 1 },
						padding: { base: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "8sp", inlineStart: "8sp" } },
					},
					radius: "theme",
				}),
			],
			initial: 10,
			max: 20,
			min: 5,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
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
										pointer: "/copy/heading",
										tone: "primary",
									}),
									text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
								],
								gap: "4sp",
							}),
						],
						gap: "4sp",
						layout: { maxInlineSize: "48rem" },
					}),
					grid({ children: [], columns: { base: 2, wide: 5 }, gap: "3sp" }),
				],
				gap: { base: "8sp", compact: "16sp" },
				padding: { base: "20sp", compact: "24sp" },
			}),
		],
	}),
});
