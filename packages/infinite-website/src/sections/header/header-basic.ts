import { defineSection } from "../section-definition";
import {
	headerBrand,
	headerButton,
	headerContainer,
	headerMenu,
	headerNavigationItem,
	headerPanelLink,
	headerRepeaters,
	headerSocialAction,
} from "./_shared/durable-header";

export const headerBasicSection = defineSection({
	category: "header",
	pattern: "header-basic",
	repeaters: headerRepeaters({
		actions: {
			create: ({ index }) => headerButton({ index, variant: index === 0 ? "primary" : "outline" }),
			initial: 2,
		},
		navigation: {
			create: ({ index, item }) => headerNavigationItem({ index, item, tone: "primary" }),
			initial: 4,
		},
		panelLink: ({ index, parent }) => headerPanelLink({ index, parent }),
		socials: { create: ({ icon, index }) => headerSocialAction({ icon, index }), initial: 3 },
	}),
	root: headerContainer({
		menu: headerMenu({
			layout: { padding: { blockEnd: "4sp", blockStart: "4sp" } },
			props: {
				actions: [],
				align: "start",
				brand: [headerBrand()],
				collapseAt: "medium",
				fill: "transparent",
				itemGap: "2.25rem",
				items: [],
				radius: "none",
				showMenuDivider: true,
				socialActions: [],
			},
		}),
	}),
});
