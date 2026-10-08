import { actionsRepeater, buttonRow, contentLayout, sectionPadding, textNode } from "../call-to-action/_shared/parts";
import { defineSection } from "../section-definition";
import { disclosureItem, dividedList, icon, itemAnswer, itemQuestion, itemRepeater } from "./_shared/disclosure-parts";

export const faqAccordionSection = defineSection({
	category: "faq",
	pattern: "faq-accordion",
	repeaters: [
		actionsRepeater({
			initial: 0,
			kinds: ["outline", "secondary"],
			min: 0,
			target: "/props/children/0/props/children/0/props/children/1/props/children/2/props/children",
		}),
		itemRepeater({
			createValues: ({ index }) => [
				disclosureItem({
					answer: itemAnswer({ appearance: "body-md", index }),
					trigger: [
						itemQuestion({ appearance: "body-md-em", index }),
						icon({ name: "chevron-down", tone: "accent-text" }),
					],
				}),
			],
			initial: 5,
			target: "/props/children/0/props/children/1/props/children/1/props/items",
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
								layout: { inlineSize: "full", maxInlineSize: "36rem" },
								props: {
									align: "center",
									children: [
										textNode({
											align: "center",
											appearance: "label-md",
											element: "span",
											pointer: "/copy/kicker",
											tone: "muted",
										}),
										{
											layout: { inlineSize: "full" },
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
													buttonRow({ justify: "center", layout: { inlineSize: "full" } }),
												],
												direction: "column",
												gap: "6sp",
											},
											type: "flex",
										},
									],
									direction: "column",
									gap: "4sp",
								},
								type: "flex",
							},
							dividedList({
								divider: "between",
								layout: { maxInlineSize: "48rem" },
								openIndicator: "rotate-180",
								panelPadding: "6sp",
								triggerPadding: "6sp",
							}),
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
