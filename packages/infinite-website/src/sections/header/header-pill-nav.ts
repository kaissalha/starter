import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import {
	headerBrand,
	headerButton,
	headerContainer,
	headerMenu,
	headerNavigationItem,
	headerRepeaters,
} from "./_shared/durable-header";

const panelLink = ({ index, parent }: { index: number; parent: number }) =>
	({
		layout: {
			inlineSize: "full",
			padding: {
				base: { blockEnd: "3sp", blockStart: "3sp", inlineEnd: "4sp", inlineStart: "4sp" },
				wide: { blockEnd: "2sp", blockStart: "2sp", inlineEnd: "2.5sp", inlineStart: "2.5sp" },
			},
		},
		props: {
			align: "center",
			children: [
				{
					layout: { grow: 1 },
					props: {
						align: "start",
						children: [
							{
								layout: { padding: { blockEnd: "0.5sp" } },
								props: {
									children: [
										{
											props: {
												appearance: "body-sm",
												content: {
													$text: `/navigation/items/${parent}/dropdown/items/${index}/label`,
												},
												element: "span",
												style: "italic",
												tone: "current",
											},
											type: "text",
										},
									],
									fill: "transparent",
									foreground: "primary",
									href: { $link: `/navigation/items/${parent}/dropdown/items/${index}/link` },
									radius: "theme",
								},
								type: "action",
							},
							{
								props: {
									appearance: "label-sm",
									content: {
										$text: `/navigation/items/${parent}/dropdown/items/${index}/description`,
									},
									element: "span",
									tone: "muted",
								},
								type: "text",
							},
						],
						direction: "column",
						justify: "center",
					},
					type: "flex",
				},
				{ props: { name: "arrow-end", size: "4sp", tone: "primary" }, type: "icon" },
			],
			direction: "row",
			gap: "4sp",
			justify: "between",
		},
		type: "flex",
	}) satisfies SiteNodeDefinition;

export const headerPillNavSection = defineSection({
	category: "header",
	pattern: "header-pill-nav",
	repeaters: headerRepeaters({
		actions: {
			create: ({ index }) => headerButton({ index, size: "xs", variant: "outline" }),
			initial: 1,
			max: 1,
		},
		navigation: {
			create: ({ index, item }) =>
				headerNavigationItem({
					appearance: "label-md",
					chevronLayout: { margin: { inlineEnd: "1.5sp" } },
					index,
					item,
					itemLayout: {
						padding: { blockEnd: "1sp", blockStart: "1sp", inlineEnd: "2.5sp", inlineStart: "2.5sp" },
					},
					tone: "primary",
				}),
			initial: 4,
		},
		panelLink,
	}),
	root: headerContainer({
		menu: headerMenu({
			layout: {
				padding: { base: { blockEnd: "3sp", blockStart: "3sp" }, wide: { blockEnd: "2sp", blockStart: "2sp" } },
			},
			props: {
				actions: [],
				align: "end",
				brand: [headerBrand()],
				collapseAt: "medium",
				fill: "transparent",
				foreground: "media",
				itemAppearance: { fill: "current", fillOpacity: 0.16, radius: "theme" },
				itemGap: "1.5sp",
				items: [],
				menuTriggerSide: "end",
				mobileTriggerAppearance: { fill: "current", fillOpacity: 0.16, radius: "theme" },
				showMenuDivider: false,
			},
		}),
	}),
});
