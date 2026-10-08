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

export const headerDetachedTransparentSection = defineSection({
	category: "header",
	pattern: "header-detached-transparent",
	repeaters: headerRepeaters({
		actions: { create: ({ index }) => headerButton({ index, variant: "primary" }), initial: 1, max: 1 },
		navigation: {
			create: ({ index, item }) => headerNavigationItem({ index, item, tone: "muted" }),
			initial: 4,
		},
		panelLink: ({ index, parent }) => headerPanelLink({ index, parent }),
	}),
	root: headerContainer({
		menu: headerMenu({
			layout: {
				margin: { blockStart: "4sp" },
				padding: {
					base: { blockEnd: "1sp", blockStart: "1sp", inlineEnd: "1sp", inlineStart: "1sp" },
					wide: { blockEnd: "1sp", blockStart: "1sp", inlineEnd: "1sp", inlineStart: "4sp" },
				},
			},
			props: {
				actions: [],
				align: "center",
				border: { color: "border", width: "1px" },
				brand: [headerBrand()],
				collapseAt: "medium",
				fill: "subtle",
				items: [],
				radius: "theme",
				showMenuDivider: false,
			},
		}),
	}),
});
