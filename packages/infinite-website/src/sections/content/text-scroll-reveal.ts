import { defineSection } from "../section-definition";

export const textScrollRevealSection = defineSection({
	category: "content",
	pattern: "text-scroll-reveal",
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
							base: { blockEnd: "20sp", blockStart: "20sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
							compact: {
								blockEnd: "24sp",
								blockStart: "24sp",
								inlineEnd: "1.5rem",
								inlineStart: "1.5rem",
							},
						},
					},
					props: {
						children: [
							{
								props: {
									appearance: "heading-lg",
									content: { $text: "/copy/description" },
									element: "p",
									scrollReveal: true,
								},
								type: "text",
							},
						],
						direction: "column",
						gap: "8sp",
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
