import type { SiteNodeDefinition } from "../../document/structure-schema";
import { actionsRepeater, buttonRow, contentLayout, textNode } from "../call-to-action/_shared/parts";
import { defineSection } from "../section-definition";
import { disclosureItem, dividedList, itemAnswer, itemQuestion, itemRepeater } from "./_shared/disclosure-parts";

const edgeLine = ({ edge }: { edge: "inlineEnd" | "inlineStart" }) => {
	return {
		layout: {
			inlineSize: "1px",
			inset: { blockEnd: 0, blockStart: 0, ...(edge === "inlineEnd" ? { inlineEnd: 0 } : { inlineStart: 0 }) },
			position: "absolute",
			visibility: { base: "removed", wide: "visible" },
		},
		props: { children: [], decorative: true, fill: "border" },
		type: "box",
	} satisfies SiteNodeDefinition;
};

const rowPadding = { base: { inlineEnd: 0, inlineStart: 0 }, wide: { inlineEnd: "4sp", inlineStart: "4sp" } };

export const faqEditorialSplitSection = defineSection({
	category: "faq",
	pattern: "faq-editorial-split",
	repeaters: [
		actionsRepeater({
			initial: 0,
			kinds: ["outline", "secondary"],
			min: 0,
			target: "/props/children/0/props/children/0/props/children/1/props/children/1/props/children",
		}),
		itemRepeater({
			createValues: ({ index }) => [
				disclosureItem({
					answer: itemAnswer({ appearance: "body-sm", index }),
					gap: "2sp",
					panelPadding: rowPadding,
					rowPadding,
					trigger: [
						textNode({
							appearance: "body-md",
							element: "span",
							layout: { shrink: 0 },
							pointer: `/items/items/${index}/number-label`,
						}),
						itemQuestion({ appearance: "body-md", index }),
					],
				}),
			],
			initial: 4,
			target: "/props/children/0/props/children/1/props/children/2/props/children/1/props/items",
		}),
	],
	root: {
		layout: {},
		props: {
			children: [
				{
					layout: {
						...contentLayout,
						padding: { base: { inlineEnd: "1.5rem", inlineStart: "1.5rem" } },
					},
					props: {
						children: [
							{
								layout: {
									padding: {
										base: { blockEnd: "16sp", blockStart: "16sp" },
										compact: { blockEnd: "20sp", blockStart: "20sp" },
									},
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
													textNode({
														appearance: "display-sm",
														element: "h2",
														pointer: "/copy/heading",
													}),
												],
												direction: "column",
												gap: "4sp",
											},
											type: "flex",
										},
										{
											props: {
												children: [
													textNode({
														appearance: "body-md",
														layout: { maxInlineSize: "32rem" },
														pointer: "/copy/description",
													}),
													buttonRow({}),
												],
												direction: "column",
												gap: "6sp",
											},
											type: "flex",
										},
									],
									direction: "column",
									gap: "8sp",
									justify: "between",
								},
								type: "flex",
							},
							{
								layout: {
									padding: {
										base: { blockEnd: "16sp" },
										compact: { blockEnd: "20sp" },
										wide: { blockEnd: "20sp", blockStart: "20sp" },
									},
									position: "relative",
								},
								props: {
									children: [
										edgeLine({ edge: "inlineStart" }),
										edgeLine({ edge: "inlineEnd" }),
										dividedList({
											defaultOpen: "first",
											panelPadding: "6sp",
											triggerPadding: "6sp",
										}),
									],
									direction: "column",
								},
								type: "flex",
							},
						],
						columns: { base: 1, wide: 2 },
					},
					type: "grid",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
