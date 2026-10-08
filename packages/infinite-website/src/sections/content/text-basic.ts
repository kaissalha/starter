import { defineSection } from "../section-definition";

export const textBasicSection = defineSection({
	category: "content",
	pattern: "text-basic",
	root: {
		layout: {},
		props: {
			children: [
				{
					layout: {
						inlineSize: "full",
						margin: { inlineEnd: "auto", inlineStart: "auto" },
						maxInlineSize: "96rem",
						padding: {
							base: { blockEnd: "16sp", blockStart: "16sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
							compact: {
								blockEnd: "20sp",
								blockStart: "20sp",
								inlineEnd: "1.5rem",
								inlineStart: "1.5rem",
							},
						},
					},
					props: {
						children: [
							{
								props: {
									appearance: "label-md",
									content: { $text: "/copy/kicker" },
									element: "span",
									tone: "muted",
								},
								type: "text",
							},
							{
								layout: { inlineSize: "full", maxInlineSize: "48rem" },
								props: {
									children: [
										{
											layout: { maxInlineSize: { base: "full", compact: "120sp" } },
											props: {
												appearance: "display-sm",
												content: { $text: "/copy/heading" },
												element: "h2",
												font: "brand",
											},
											type: "text",
										},
										{
											layout: { maxInlineSize: { base: "full", compact: "42rem" } },
											props: {
												appearance: "body-md",
												content: { $text: "/copy/description" },
												element: "p",
												tone: "muted",
											},
											type: "text",
										},
									],
									direction: "column",
									gap: { base: "4sp", compact: "6sp" },
								},
								type: "flex",
							},
						],
						direction: "column",
						gap: { base: "4sp", compact: "6sp" },
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
