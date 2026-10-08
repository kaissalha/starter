import { defineSection } from "../section-definition";
import { backgroundMedia } from "./_shared/background-media";
import { actionsRepeater, buttonRow, contentLayout, sectionPadding, textNode } from "./_shared/parts";

export const ctaEditorialImageSection = defineSection({
	category: "call-to-action",
	pattern: "cta-editorial-image",
	repeaters: [
		actionsRepeater({
			initial: 1,
			kinds: ["primary", "secondary"],
			target: "/props/children/1/props/children/0/props/children/1/props/children/1/props/children",
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
						children: [
							{
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
														layout: { maxInlineSize: "36rem" },
														pointer: "/copy/heading",
													}),
												],
												direction: "column",
												gap: "2sp",
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
												gap: "6sp",
											},
											type: "flex",
										},
									],
									direction: "column",
									gap: { base: "24sp", wide: "28sp" },
								},
								type: "flex",
							},
						],
						direction: "column",
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
