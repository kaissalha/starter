import { actionsRepeater, buttonRow, contentLayout, sectionPadding, textNode } from "../call-to-action/_shared/parts";
import { defineSection } from "../section-definition";
import { itemRepeater } from "./_shared/disclosure-parts";

export const faqCardSection = defineSection({
	category: "faq",
	pattern: "faq-card",
	repeaters: [
		actionsRepeater({
			initial: 1,
			kinds: ["outline"],
			target: "/props/children/0/props/children/2/props/children/1/props/children",
		}),
		itemRepeater({
			createValues: ({ index }) => [
				{
					layout: { padding: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" } },
					props: {
						children: [
							textNode({
								appearance: "body-md-em",
								element: "h3",
								pointer: `/items/items/${index}/question`,
							}),
							textNode({ appearance: "body-md", pointer: `/items/items/${index}/answer`, tone: "muted" }),
						],
						direction: "column",
						fill: "tint",
						gap: "2sp",
						radius: "theme",
					},
					type: "flex",
				},
			],
			initial: 6,
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
														appearance: "body-lg",
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
								layout: { inlineSize: "full" },
								props: { children: [], columns: { base: 1, compact: 2, wide: 3 }, gap: "4sp" },
								type: "grid",
							},
							{
								layout: { inlineSize: "full", maxInlineSize: "36rem" },
								props: {
									align: "center",
									children: [
										{
											layout: { inlineSize: "full" },
											props: {
												align: "center",
												children: [
													textNode({
														align: "center",
														appearance: "heading-lg",
														element: "h3",
														pointer: "/copy/bottomTitle",
													}),
													textNode({
														align: "center",
														appearance: "body-md",
														pointer: "/copy/bottomDescription",
														tone: "muted",
													}),
												],
												direction: "column",
												gap: "4sp",
											},
											type: "flex",
										},
										buttonRow({ justify: "center", layout: { inlineSize: "full" } }),
									],
									direction: "column",
									gap: "6sp",
								},
								type: "flex",
							},
						],
						direction: "column",
						gap: "16sp",
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
