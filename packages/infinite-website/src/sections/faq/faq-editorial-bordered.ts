import type { SiteNodeDefinition } from "../../document/structure-schema";
import { actionsRepeater, buttonRow, contentLayout, textNode } from "../call-to-action/_shared/parts";
import { defineSection } from "../section-definition";
import {
	disclosureItem,
	divider,
	dividedList,
	icon,
	itemAnswer,
	itemQuestion,
	itemRepeater,
} from "./_shared/disclosure-parts";

const spacer = () => {
	return {
		layout: { blockSize: "16sp", inlineSize: "full" },
		props: { children: [], decorative: true, fill: "tint", pattern: "diagonal-slash" },
		type: "box",
	} satisfies SiteNodeDefinition;
};

export const faqEditorialBorderedSection = defineSection({
	category: "faq",
	pattern: "faq-editorial-bordered",
	repeaters: [
		actionsRepeater({
			initial: 1,
			kinds: ["secondary"],
			target: "/props/children/1/props/children/0/props/children/1/props/children/1/props/children",
		}),
		itemRepeater({
			createValues: ({ index }) => [
				disclosureItem({
					answer: itemAnswer({ appearance: "body-sm", index }),
					panelPadding: { inlineEnd: "6sp", inlineStart: "6sp" },
					rowPadding: { inlineEnd: "6sp", inlineStart: "6sp" },
					trigger: [itemQuestion({ appearance: "body-sm", index }), icon({ name: "plus" })],
				}),
			],
			initial: 4,
			target: "/props/children/1/props/children/1/props/children/1/props/children/1/props/items",
		}),
	],
	root: {
		layout: {},
		props: {
			children: [
				divider(),
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
										base: { blockStart: "12sp", inlineStart: 0 },
										compact: { blockStart: "16sp", inlineStart: 0 },
										wide: {
											blockEnd: "16sp",
											blockStart: "16sp",
											inlineEnd: "12sp",
											inlineStart: 0,
										},
									},
								},
								props: {
									children: [
										{
											props: {
												children: [
													textNode({
														appearance: "heading-sm",
														element: "h2",
														layout: { maxInlineSize: "36rem" },
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
														layout: { maxInlineSize: "36rem" },
														pointer: "/copy/description",
														tone: "muted",
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
									gap: "2sp",
									justify: { base: "start", wide: "between" },
								},
								type: "flex",
							},
							{
								props: {
									border: { color: "border", sides: ["inline-start", "inline-end"], width: 1 },
									children: [
										spacer(),
										dividedList({
											defaultOpen: "first",
											openIndicator: "rotate-45",
											panelPadding: "6sp",
											triggerPadding: "6sp",
										}),
										spacer(),
									],
									direction: "column",
								},
								type: "flex",
							},
						],
						columns: { base: 1, wide: 2 },
						gap: { base: "12sp", wide: 0 },
					},
					type: "grid",
				},
				divider(),
			],
			fill: "canvas",
		},
		type: "box",
	},
});
