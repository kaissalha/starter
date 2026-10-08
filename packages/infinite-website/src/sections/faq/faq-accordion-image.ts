import { contentLayout, sectionPadding, textNode } from "../call-to-action/_shared/parts";
import { defineSection } from "../section-definition";
import { disclosureItem, dividedList, icon, itemAnswer, itemQuestion, itemRepeater } from "./_shared/disclosure-parts";

export const faqAccordionImageSection = defineSection({
	category: "faq",
	pattern: "faq-accordion-image",
	repeaters: [
		itemRepeater({
			createValues: ({ index }) => [
				{
					layout: {
						inlineSize: "full",
						padding: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" },
					},
					props: {
						children: [
							dividedList({
								divider: false,
								items: [
									disclosureItem({
										answer: itemAnswer({ appearance: "body-md", index }),
										panelPadding: { blockStart: "4sp" },
										trigger: [
											itemQuestion({ appearance: "body-md-em", index }),
											icon({ name: "chevron-down", tone: "accent-text" }),
										],
									}),
								],
								leading: false,
								openIndicator: "rotate-180",
								panelPadding: 0,
								triggerPadding: 0,
							}),
						],
						direction: "column",
						fill: "tint",
						radius: "theme",
					},
					type: "flex",
				},
			],
			initial: 4,
			target: "/props/children/0/props/children/1/props/children/0/props/children",
		}),
	],
	root: {
		layout: {},
		props: {
			children: [
				{
					layout: {
						...contentLayout,
						padding: sectionPadding({ base: ["16sp", "16sp"], compact: ["20sp", "20sp"] }),
					},
					props: {
						children: [
							textNode({
								align: "center",
								appearance: "display-sm",
								element: "h2",
								pointer: "/copy/heading",
							}),
							{
								props: {
									align: "start",
									children: [
										{
											props: { children: [], direction: "column", gap: "4sp" },
											type: "flex",
										},
										{
											layout: {
												aspectRatio: { height: 1, width: 1 },
												inlineSize: "full",
												inset: { blockStart: 0 },
												position: "sticky",
												visibility: { base: "removed", wide: "visible" },
											},
											props: {
												alt: { $text: "/media/items/0/alt" },
												assetId: { $asset: "/media/items/0/assetId" },
												fill: "subtle",
												fit: "cover",
												radius: "theme",
											},
											type: "media",
										},
									],
									columns: { base: 1, wide: 2 },
									gap: { base: "12sp", wide: "16sp" },
								},
								type: "grid",
							},
						],
						direction: "column",
						gap: "12sp",
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
