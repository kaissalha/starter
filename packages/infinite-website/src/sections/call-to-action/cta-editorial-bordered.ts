import { defineSection } from "../section-definition";
import { actionsRepeater, contentLayout, textNode } from "./_shared/parts";

export const ctaEditorialBorderedSection = defineSection({
	category: "call-to-action",
	pattern: "cta-editorial-bordered",
	repeaters: [
		actionsRepeater({
			initial: 1,
			kinds: ["secondary", "outline"],
			target: "/props/children/0/props/children/0/props/children/1/props/children",
		}),
	],
	root: {
		layout: {},
		props: {
			children: [
				{
					layout: {
						...contentLayout,
						padding: {
							base: { blockEnd: 0, blockStart: "12sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
							compact: { blockEnd: 0, blockStart: "16sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
						},
					},
					props: {
						children: [
							{
								layout: {
									padding: {
										base: {
											blockEnd: "12sp",
											blockStart: "12sp",
											inlineEnd: "12sp",
											inlineStart: "12sp",
										},
										compact: {
											blockEnd: "16sp",
											blockStart: "16sp",
											inlineEnd: "10sp",
											inlineStart: "10sp",
										},
										wide: {
											blockEnd: "16sp",
											blockStart: "16sp",
											inlineEnd: "8sp",
											inlineStart: "8sp",
										},
									},
								},
								props: {
									align: { base: "stretch", compact: "center" },
									border: { color: "border", width: 1 },
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
													textNode({
														appearance: "body-md",
														layout: { maxInlineSize: "32rem" },
														pointer: "/copy/description",
														tone: "muted",
													}),
												],
												direction: "column",
												gap: "2sp",
											},
											type: "flex",
										},
										{
											props: {
												align: { base: "stretch", compact: "start" },
												children: [],
												direction: { base: "column", wide: "row" },
												gap: "4sp",
												wrap: "wrap",
											},
											type: "flex",
										},
									],
									direction: { base: "column", compact: "row" },
									gap: "6sp",
									justify: { base: "start", compact: "between" },
									radius: { startEnd: "theme", startStart: "theme" },
								},
								type: "flex",
							},
							{
								layout: { blockSize: "16sp", inlineSize: "full" },
								props: {
									border: { color: "border", sides: ["inline-start", "inline-end"], width: 1 },
									children: [],
									decorative: true,
									fill: "tint",
									pattern: "diagonal-slash",
								},
								type: "box",
							},
						],
						direction: "column",
					},
					type: "flex",
				},
				{
					layout: { blockSize: "1px", inlineSize: "full" },
					props: { children: [], decorative: true, fill: "border" },
					type: "box",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
