import { defineSection } from "../section-definition";
import { splitIntro } from "./_shared/metrics-intro";
import { flex, frameLayout, pad, sectionBox, space, text, verticalDivider } from "./_shared/parts";

const staggers = [24, 16, 8];

export const metricsBasicSection = defineSection({
	category: "metrics",
	pattern: "metrics-basic",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					children: [
						flex({
							children: [
								verticalDivider(),
								flex({
									children: [
										text({
											appearance: "heading-lg",
											pointer: `/items/items/${index}/metric`,
											tone: "muted",
										}),
										flex({
											children: [
												text({
													appearance: "body-md-em",
													pointer: `/items/items/${index}/title`,
												}),
												text({
													appearance: "body-sm",
													pointer: `/items/items/${index}/description`,
													tone: "muted",
												}),
											],
											gap: space(2),
										}),
									],
									gap: space(8),
									layout: { padding: pad({ x: 6 }) },
								}),
							],
							direction: "row",
							layout: { grow: 1 },
						}),
					],
					layout: {
						grow: 1,
						inlineSize: { base: "full", compact: 0 },
						minInlineSize: { base: 0, compact: "40%", wide: 0 },
						padding: pad({ top: { base: 0, wide: staggers[index] ?? 0 } }),
					},
				}),
			],
			initial: 4,
			max: 4,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionBox({
		children: [
			flex({
				children: [
					splitIntro({ buttonAppearance: "secondary" }),
					flex({ children: [], direction: { base: "column", compact: "row" }, gap: space(4), wrap: "wrap" }),
				],
				gap: space(8),
				layout: frameLayout({ y: { base: 16, compact: 20 } }),
			}),
		],
	}),
});
