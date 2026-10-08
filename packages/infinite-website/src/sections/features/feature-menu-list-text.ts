import { defineSection } from "../section-definition";
import { menuItemText, menuSectionRoot } from "./_shared/menu-section";
import { divider, flex, text } from "./_shared/section-parts";

export const featureMenuListTextSection = defineSection({
	category: "features",
	pattern: "feature-menu-list-text",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				...(index > 0 ? [divider()] : []),
				flex({
					align: { base: "stretch", compact: "start" },
					children: [
						menuItemText({ index }),
						text({
							appearance: "body-lg-em",
							layout: { shrink: 0 },
							pointer: `/items/items/${index}/price`,
						}),
					],
					direction: { base: "column", compact: "row" },
					gap: { base: "2sp", compact: "4sp", wide: "6sp" },
					justify: { base: "start", compact: "between" },
				}),
			],
			initial: 6,
			max: 10,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: menuSectionRoot({ list: flex({ children: [], gap: "4sp" }) }),
});
