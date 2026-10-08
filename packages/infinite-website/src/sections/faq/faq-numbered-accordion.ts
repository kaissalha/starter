import { contentLayout, sectionPadding, textNode } from "../call-to-action/_shared/parts";
import { defineSection } from "../section-definition";
import { disclosureItem, dividedList, icon, itemAnswer, itemQuestion, itemRepeater } from "./_shared/disclosure-parts";

export const faqNumberedAccordionSection = defineSection({
	category: "faq",
	pattern: "faq-numbered-accordion",
	repeaters: [
		itemRepeater({
			createValues: ({ index }) => [
				disclosureItem({
					answer: itemAnswer({ appearance: "body-md", index, layout: { maxInlineSize: "48rem" } }),
					gap: "6sp",
					panelPadding: { inlineStart: "10sp" },
					trigger: [
						textNode({
							appearance: "body-sm",
							element: "span",
							layout: { shrink: 0 },
							pointer: `/items/items/${index}/number-label`,
							tone: "muted",
						}),
						itemQuestion({ appearance: "body-lg-em", index }),
						icon({ name: "plus", size: "3sp", tone: "accent-text" }),
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
						children: [
							textNode({ appearance: "display-md", element: "h2", pointer: "/copy/heading" }),
							dividedList({ openIndicator: "rotate-45", panelPadding: "6sp", triggerPadding: "6sp" }),
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
