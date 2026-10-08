import { defineSection } from "../section-definition";
import { contentFrame, flex, grid, kicker, sectionBox, text } from "./_shared/section-parts";

export const featureTextStackedSection = defineSection({
	category: "features",
	pattern: "feature-text-stacked",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					children: [
						text({ appearance: "heading-md", element: "h3", pointer: `/items/items/${index}/title` }),
						text({ appearance: "body-md", pointer: `/items/items/${index}/description`, tone: "muted" }),
					],
					gap: "2sp",
				}),
			],
			initial: 4,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					flex({
						children: [
							flex({
								children: [
									kicker(),
									text({
										appearance: "display-md",
										element: "h2",
										layout: { maxInlineSize: "36rem" },
										pointer: "/copy/heading",
									}),
								],
								gap: "4sp",
							}),
							text({
								appearance: "body-md",
								layout: { maxInlineSize: "42rem" },
								pointer: "/copy/description",
								tone: "muted",
							}),
						],
						gap: "6sp",
					}),
					grid({ children: [], columns: { base: 1, compact: 2 }, gap: "8sp" }),
				],
				gap: "16sp",
				padding: { base: "16sp", compact: "20sp" },
			}),
		],
	}),
});
