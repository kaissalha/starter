import { defineSection } from "../section-definition";
import { centeredCopy } from "./_shared/copy-block";
import { actionsRepeater, contentLayout, sectionPadding } from "./_shared/parts";

export const ctaCardSection = defineSection({
	category: "call-to-action",
	pattern: "cta-card",
	repeaters: [
		actionsRepeater({
			kinds: ["secondary", "outline"],
			target: "/props/children/0/props/children/0/props/children/1/props/children/1/props/children",
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
									padding: sectionPadding({
										base: ["16sp", "16sp"],
										compact: ["20sp", "20sp"],
										inline: "6sp",
									}),
								},
								props: {
									align: "center",
									children: centeredCopy(),
									direction: "column",
									fill: "tint",
									gap: "4sp",
									justify: "center",
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
