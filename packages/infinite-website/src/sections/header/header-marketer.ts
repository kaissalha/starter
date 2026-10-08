import { defineSection } from "../section-definition";
import {
	headerBrand,
	headerButton,
	headerContainer,
	headerMenu,
	headerNavigationItem,
	headerPanelLink,
	headerRepeaters,
} from "./_shared/durable-header";

const [brand] = [headerBrand()];

export const headerMarketerSection = defineSection({
	category: "header",
	pattern: "header-marketer",
	repeaters: headerRepeaters({
		actions: { create: ({ index }) => headerButton({ index, variant: "primary" }), initial: 1, max: 1 },
		navigation: {
			create: ({ index, item }) =>
				headerNavigationItem({
					appearance: "body-md",
					index,
					item,
					mobileAppearance: "heading-md",
					tone: "muted",
				}),
			initial: 4,
		},
		panelLink: ({ index, parent }) => headerPanelLink({ index, parent }),
	}),
	root: headerContainer({
		menu: headerMenu({
			layout: {
				margin: { blockStart: "3sp" },
				padding: { blockEnd: "1sp", blockStart: "1sp", inlineEnd: "1sp", inlineStart: "1sp" },
			},
			props: {
				actions: [],
				align: "center",
				brand: [
					{
						...brand,
						layout: {
							...brand.layout,
							padding: { base: { inlineStart: "3sp" }, wide: { inlineStart: "4sp" } },
						},
					},
				],
				collapseAt: "medium",
				fill: "subtle",
				items: [],
				radius: "theme",
				showMenuDivider: false,
			},
		}),
		rootAppearance: { fill: "transparent" },
	}),
});
