import { defineSection } from "../section-definition";
import { actionsRepeater, buttonRow, contentLayout, sectionPadding, textNode } from "./_shared/parts";

export const ctaCard2Section = defineSection({
	category: "call-to-action",
	pattern: "cta-card-2",
	repeaters: [
		actionsRepeater({
			initial: 1,
			kinds: ["primary", "outline"],
			target: "/props/children/0/props/children/0/props/children/0/props/children/1/props/children",
		}),
	],
	root: {
		layout: {},
		props: {
			children: [
				{
					layout: {
						...contentLayout,
						padding: sectionPadding({ base: ["8sp", "8sp"], compact: ["10sp", "10sp"] }),
					},
					props: {
						children: [
							{
								layout: {
									inlineSize: "full",
									margin: { inlineEnd: "auto", inlineStart: "auto" },
									maxInlineSize: "90rem",
									padding: {
										base: {
											blockEnd: "16sp",
											blockStart: "16sp",
											inlineEnd: "6sp",
											inlineStart: "6sp",
										},
										compact: {
											blockEnd: "20sp",
											blockStart: "20sp",
											inlineEnd: "12sp",
											inlineStart: "12sp",
										},
										wide: {
											blockEnd: "22sp",
											blockStart: "22sp",
											inlineEnd: "16sp",
											inlineStart: "16sp",
										},
									},
								},
								props: {
									align: "center",
									children: [
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
													buttonRow({ justify: "center" }),
												],
												direction: "column",
												gap: "6sp",
											},
											type: "flex",
										},
									],
									direction: "column",
									fill: "tint",
									radius: "theme",
								},
								type: "flex",
							},
						],
						direction: "column",
						gap: 0,
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
