import { defineSection } from "../section-definition";
import { menuItemText, menuSectionRoot } from "./_shared/menu-section";
import { flex, grid, image, text } from "./_shared/section-parts";

export const featureMenuGridSection = defineSection({
	category: "features",
	pattern: "feature-menu-grid",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					children: [
						image({ blockSize: "70sp", inlineSize: "full", pointer: `/items/items/${index}` }),
						menuItemText({ index }),
						text({ appearance: "body-lg-em", pointer: `/items/items/${index}/price` }),
					],
					gap: "4sp",
				}),
			],
			initial: 6,
			max: 8,
			min: 3,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: menuSectionRoot({ list: grid({ children: [], columns: { base: 1, compact: 2, wide: 3 }, gap: "6sp" }) }),
});
