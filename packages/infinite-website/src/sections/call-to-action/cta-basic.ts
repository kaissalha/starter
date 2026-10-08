import { defineSection } from "../section-definition";
import { centeredCopy } from "./_shared/copy-block";
import { actionsRepeater, contentLayout, sectionPadding } from "./_shared/parts";

export const ctaBasicSection = defineSection({
	category: "call-to-action",
	pattern: "cta-basic",
	repeaters: [
		actionsRepeater({
			kinds: ["secondary", "outline"],
			target: "/props/children/0/props/children/1/props/children/1/props/children",
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
						children: centeredCopy(),
						direction: "column",
						gap: "4sp",
						justify: "center",
					},
					type: "flex",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});
