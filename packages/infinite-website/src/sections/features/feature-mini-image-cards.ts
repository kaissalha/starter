import { defineSection } from "../section-definition";
import { allEdges, contentFrame, flex, grid, image, kicker, sectionBox, text } from "./_shared/section-parts";

export const featureMiniImageCardsSection = defineSection({
	category: "features",
	pattern: "feature-mini-image-cards",
	repeaters: [
		{
			collection: "/cards",
			createValues: ({ index }) => [
				flex({
					children: [
						image({
							aspectRatio: { height: 1, width: 1 },
							inlineSize: "24sp",
							layout: { shrink: 0 },
							pointer: `/cards/items/${index}`,
						}),
						flex({
							children: [
								text({
									appearance: "heading-sm",
									element: "h3",
									pointer: `/cards/items/${index}/title`,
								}),
								text({
									appearance: "body-sm",
									pointer: `/cards/items/${index}/description`,
									tone: "muted",
								}),
							],
							gap: "2sp",
						}),
					],
					fill: "tint",
					justify: "between",
					layout: { padding: { base: allEdges("6sp"), compact: allEdges("8sp") } },
					radius: "theme",
				}),
			],
			initial: 2,
			max: 4,
			min: 1,
			target: "/props/children/0/props/children/1/props/children/0/props/children",
		},
	],
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					flex({
						align: { base: "stretch", wide: "end" },
						children: [
							flex({
								children: [
									flex({
										children: [
											kicker(),
											text({ appearance: "display-sm", element: "h2", pointer: "/copy/heading" }),
										],
										gap: "4sp",
										layout: { maxInlineSize: "36rem" },
									}),
								],
								layout: { inlineSize: { base: "full", wide: "50%" } },
							}),
							flex({
								children: [
									text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
								],
								layout: { inlineSize: { base: "full", wide: "33.3333%" } },
							}),
						],
						direction: { base: "column", wide: "row" },
						gap: "6sp",
						justify: "between",
					}),
					grid({
						children: [
							grid({
								children: [],
								columns: { base: 1, wide: 2 },
								gap: "3sp",
								layout: { gridColumn: { base: { span: 1, start: 1 }, wide: { span: 2, start: 1 } } },
							}),
							image({
								layout: { minBlockSize: "80sp" },
								pointer: "/media/items/0",
							}),
						],
						columns: { base: 1, wide: 3 },
						gap: "3sp",
					}),
				],
				gap: "12sp",
				padding: { base: "16sp", compact: "20sp" },
			}),
		],
	}),
});
