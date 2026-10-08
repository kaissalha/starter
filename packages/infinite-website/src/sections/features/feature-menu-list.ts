import { defineSection } from "../section-definition";
import { menuItemText, menuSectionRoot } from "./_shared/menu-section";
import { flex, image, text } from "./_shared/section-parts";

export const featureMenuListSection = defineSection({
	category: "features",
	pattern: "feature-menu-list",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					children: [
						image({
							aspectRatio: { height: 2, width: 3 },
							inlineSize: { base: "full", compact: "40sp", wide: "64sp" },
							layout: { shrink: 0 },
							pointer: `/items/items/${index}`,
						}),
						flex({
							align: { base: "stretch", wide: "start" },
							children: [
								menuItemText({ grow: 1, index }),
								text({
									appearance: "body-lg-em",
									layout: { shrink: 0 },
									pointer: `/items/items/${index}/price`,
								}),
							],
							direction: { base: "column", wide: "row" },
							gap: { base: "4sp", wide: "6sp" },
							layout: { grow: 1 },
						}),
					],
					direction: { base: "column", compact: "row" },
					gap: { base: "4sp", compact: "6sp" },
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
