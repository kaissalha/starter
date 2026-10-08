import { defineSection } from "../section-definition";
import { allEdges, contentFrame, flex, image, kicker, sectionBox, text } from "./_shared/section-parts";

export const featureThreeCardSection = defineSection({
	category: "features",
	pattern: "feature-three-card",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					border: { color: "border", width: 1 },
					children: [
						flex({
							children: [
								text({
									appearance: "heading-md",
									element: "h3",
									pointer: `/items/items/${index}/title`,
								}),
								text({
									appearance: "body-md",
									pointer: `/items/items/${index}/description`,
									tone: "muted",
								}),
							],
							gap: "2sp",
						}),
					],
					fill: "canvas",
					justify: "between",
					layout: { grow: 1, padding: { base: allEdges("8sp") } },
					radius: "theme",
				}),
			],
			initial: 2,
			max: 3,
			min: 1,
			target: "/props/children/0/props/children/1/props/children/1/props/children",
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
									kicker(),
									text({ appearance: "display-sm", element: "h2", pointer: "/copy/heading" }),
								],
								gap: "4sp",
								layout: { inlineSize: { base: "full", wide: "66.6667%" } },
							}),
							flex({
								children: [
									text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
								],
								layout: { inlineSize: { base: "full", wide: "33.3333%" } },
							}),
						],
						direction: { base: "column", wide: "row" },
						gap: { base: "4sp", compact: "8sp", wide: "12sp" },
					}),
					flex({
						children: [
							image({
								aspectRatio: { height: 9, width: 16 },
								inlineSize: { base: "full", wide: "66.6667%" },
								pointer: "/media/items/0",
							}),
							flex({
								children: [],
								gap: "3sp",
								layout: { inlineSize: { base: "full", wide: "33.3333%" } },
							}),
						],
						direction: { base: "column", wide: "row" },
						gap: "3sp",
					}),
				],
				gap: "12sp",
				padding: { base: "16sp", compact: "20sp" },
			}),
		],
	}),
});
