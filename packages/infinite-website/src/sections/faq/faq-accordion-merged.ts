import { contentLayout, sectionPadding, textNode } from "../call-to-action/_shared/parts";
import { defineSection } from "../section-definition";
import { disclosureItem, dividedList, icon, itemAnswer, itemQuestion, itemRepeater } from "./_shared/disclosure-parts";

export const faqAccordionMergedSection = defineSection({
	category: "faq",
	pattern: "faq-accordion-merged",
	repeaters: [
		itemRepeater({
			createValues: ({ index }) => [
				dividedList({
					divider: false,
					items: [
						disclosureItem({
							align: "start",
							answer: itemAnswer({ appearance: "body-md", index, tone: "primary" }),
							panelPadding: { blockStart: "3sp", inlineEnd: "4sp", inlineStart: "6sp" },
							rowPadding: { inlineEnd: "4sp", inlineStart: "6sp" },
							trigger: [
								itemQuestion({ appearance: "body-md-em", index }),
								{
									layout: { blockSize: "6sp", inlineSize: "6sp", shrink: 0 },
									props: {
										align: "center",
										children: [icon({ name: "chevron-down" })],
										direction: "row",
										fill: "tint",
										justify: "center",
										radius: "full",
									},
									type: "flex",
								},
							],
						}),
					],
					leading: false,
					openIndicator: "rotate-180",
					panelPadding: "6sp",
					triggerPadding: "5sp",
				}),
			],
			initial: 5,
			target: "/props/children/0/props/children/1/props/children",
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
						align: "center",
						children: [
							{
								layout: { inlineSize: "full", maxInlineSize: "32rem" },
								props: {
									align: "center",
									children: [
										textNode({
											align: "center",
											appearance: "display-sm",
											element: "h2",
											pointer: "/copy/heading",
										}),
										textNode({
											align: "center",
											appearance: "body-md",
											pointer: "/copy/description",
											tone: "muted",
										}),
									],
									direction: "column",
									gap: "4sp",
								},
								type: "flex",
							},
							{
								layout: {
									inlineSize: "full",
									maxInlineSize: "32rem",
									overflow: "hidden",
									padding: {
										blockEnd: "2sp",
										blockStart: "2sp",
										inlineEnd: "2sp",
										inlineStart: "2sp",
									},
								},
								props: { children: [], direction: "column", fill: "tint", radius: "theme" },
								type: "flex",
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
