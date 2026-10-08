import { actionsRepeater, buttonRow, contentLayout, sectionPadding, textNode } from "../call-to-action/_shared/parts";
import { defineSection } from "../section-definition";
import { disclosureItem, dividedList, icon, itemAnswer, itemQuestion, itemRepeater } from "./_shared/disclosure-parts";

export const faqStretchSection = defineSection({
	category: "faq",
	pattern: "faq-stretch",
	repeaters: [
		actionsRepeater({
			initial: 1,
			kinds: ["primary"],
			target: "/props/children/0/props/children/1/props/children/1/props/children",
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
			initial: 6,
			target: "/props/children/0/props/children/1/props/children/0/props/children/1/props/items",
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
							{
								props: {
									children: [
										textNode({
											appearance: "label-md",
											element: "span",
											pointer: "/copy/kicker",
											tone: "muted",
										}),
										{
											props: {
												children: [
													textNode({
														appearance: "display-sm",
														element: "h2",
														layout: { maxInlineSize: "36rem" },
														pointer: "/copy/heading",
													}),
													textNode({
														appearance: "body-md",
														layout: { maxInlineSize: "42rem" },
														pointer: "/copy/description",
														tone: "muted",
													}),
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
							{
								props: {
									children: [
										dividedList({
											divider: "between",
											openIndicator: "rotate-180",
											panelPadding: "4sp",
											triggerPadding: "4sp",
										}),
										buttonRow({}),
									],
									direction: "column",
									gap: "8sp",
								},
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
