import { defineSection } from "../section-definition";
import { backgroundMedia } from "./_shared/background-media";
import { centeredCopy } from "./_shared/copy-block";
import { actionsRepeater, contentLayout, sectionPadding } from "./_shared/parts";

export const ctaBackgroundImageSection = defineSection({
	category: "call-to-action",
	pattern: "cta-background-image",
	repeaters: [
		actionsRepeater({
			kinds: ["primary", "secondary"],
			target: "/props/children/1/props/children/1/props/children/1/props/children",
		}),
	],
	root: {
		layout: { position: "relative" },
		props: {
			children: [
				backgroundMedia({ overlay: { kind: "scrim", strength: "strong" } }),
				{
					layout: {
						...contentLayout,
						padding: sectionPadding({ base: ["16sp", "16sp"], compact: ["20sp", "20sp"] }),
						position: "relative",
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
			fill: "transparent",
			foreground: "media",
		},
		type: "box",
	},
});
