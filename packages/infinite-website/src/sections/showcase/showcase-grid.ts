import { contentFrame, flex, grid, kicker, mediaAt, sectionBox, text } from "../gallery/_shared/section-parts";
import { defineSection } from "../section-definition";

export const showcaseGridSection = defineSection({
	category: "showcase",
	pattern: "showcase-grid",
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
						blockSize: "44sp",
						padding: { base: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "8sp", inlineStart: "8sp" } },
					},
					radius: "theme",
				}),
			],
			initial: 8,
			max: 16,
			min: 4,
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
								align: "start",
								children: [
									text({
										appearance: "display-sm",
										element: "h2",
										layout: { maxInlineSize: "36rem" },
										pointer: "/copy/heading",
										tone: "primary",
									}),
									flex({
										children: [
											text({
												appearance: "body-md",
												pointer: "/copy/description",
												tone: "muted",
											}),
										],
										gap: "8sp",
										layout: { inlineSize: "full", maxInlineSize: "36rem" },
									}),
								],
								direction: { base: "column", wide: "row" },
								gap: "6sp",
							}),
						],
						gap: "4sp",
					}),
					grid({ children: [], columns: { base: 2, compact: 4 }, gap: "3sp" }),
				],
				gap: { base: "8sp", compact: "12sp" },
				padding: { base: "12sp", compact: "16sp" },
			}),
		],
	}),
});
