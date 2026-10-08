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

export const headerFlushTransparentSection = defineSection({
	category: "header",
	pattern: "header-flush-transparent",
	repeaters: headerRepeaters({
		actions: { create: ({ index }) => headerButton({ index, variant: "primary" }), initial: 1, max: 1 },
		navigation: {
			create: ({ index, item }) => headerNavigationItem({ index, item, tone: "muted" }),
			initial: 4,
		},
		panelLink: ({ index, parent }) => headerPanelLink({ index, parent }),
		socials: { create: ({ icon, index }) => headerSocialAction({ icon, index }), initial: 3 },
	}),
	root: headerContainer({
		fullBleed: true,
		menu: headerMenu({
			layout: {
				padding: {
					base: { blockEnd: "4sp", blockStart: "4sp" },
					wide: { blockEnd: "3sp", blockStart: "3sp" },
				},
			},
			props: {
				actions: [],
				align: "end",
				brand: [headerBrand()],
				collapseAt: "medium",
				items: [],
				showMenuDivider: false,
				socialActions: [],
			},
		}),
		rootAppearance: { fill: "black", fillOpacity: 0.7, foreground: "media" },
	}),
});
