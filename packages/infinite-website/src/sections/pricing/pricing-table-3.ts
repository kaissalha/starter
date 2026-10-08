import type { SiteNodeDefinition } from "../../document/structure-schema";
import { actionButton, flex, frameLayout, pad, sectionBox, space, text } from "../metrics/_shared/parts";
import { defineSection } from "../section-definition";
import {
	checkRow,
	planCellLayout,
	planFeature,
	planFeaturesRepeater,
	planItem,
	startRule,
	topRule,
} from "./_shared/plan-parts";

const featured = 1;

const plan = ({ index }: { index: number }): SiteNodeDefinition =>
	flex({
		children: [
			flex({
				children: [
					text({ appearance: "heading-sm", element: "h3", pointer: planItem({ field: "title", index }) }),
					text({ appearance: "body-sm", pointer: planItem({ field: "description", index }), tone: "muted" }),
				],
				gap: space(2),
				layout: { padding: pad({ bottom: 0, top: 6, x: 6 }) },
			}),
			flex({
				children: [
					flex({
						align: "end",
						children: [
							text({ appearance: "display-sm", pointer: planItem({ field: "price", index }) }),
							text({
								appearance: "body-md",
								element: "span",
								pointer: planItem({ field: "original-price", index }),
								tone: "muted",
							}),
						],
						direction: "row",
						gap: space(2),
						wrap: "wrap",
					}),
					text({
						appearance: "body-sm",
						element: "span",
						pointer: planItem({ field: "period", index }),
						tone: "muted",
					}),
				],
				gap: space(2),
				justify: "end",
				layout: { padding: pad({ top: 6, x: 6 }) },
			}),
			flex({
				children: [
					actionButton({
						appearance: index === featured ? "primary" : "outline",
						fullWidth: true,
						labelPointer: planItem({ field: "label", index }),
						linkPointer: planItem({ field: "link", index }),
					}),
				],
				layout: { padding: pad({ top: 6, x: 6 }) },
			}),
			flex({
				children: [
					text({
						appearance: "label-sm",
						element: "span",
						pointer: planItem({ field: "features-label", index }),
						tone: "muted",
					}),
					flex({
						children: [],
						gap: space(2),
					}),
				],
				gap: space(3),
				layout: { padding: pad({ x: 6, y: 6 }) },
			}),
			...(index === 0
				? []
				: [
						topRule({ visibility: { base: "visible", wide: "removed" } }),
						startRule({ visibility: { base: "removed", wide: "visible" } }),
					]),
		],
		fill: "tint",
		layout: { ...planCellLayout, order: index === featured ? { base: -1, wide: 0 } : 0, position: "relative" },
	});

export const pricingTable3Section = defineSection({
	category: "pricing",
	pattern: "pricing-table-3",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [plan({ index })],
			initial: 3,
			max: 3,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
		planFeaturesRepeater({
			createFeature: ({ feature, index }) =>
				checkRow({ align: "center", pointer: planFeature({ feature, index }) }),
			initial: 5,
			target: "/0/props/children/3/props/children/1/props/children",
		}),
	],
	root: sectionBox({
		children: [
			flex({
				align: "center",
				children: [
					flex({
						align: "center",
						children: [
							flex({
								align: "center",
								children: [
									text({
										align: "center",
										appearance: "display-sm",
										element: "h2",
										layout: { maxInlineSize: "48rem" },
										pointer: "/copy/heading",
									}),
									text({
										align: "center",
										appearance: "body-md",
										pointer: "/copy/description",
										tone: "muted",
									}),
								],
								gap: space(6),
							}),
						],
						layout: { maxInlineSize: "42rem" },
					}),
					flex({
						border: { color: "border", width: 1 },
						children: [],
						direction: { base: "column", wide: "row" },
						layout: { inlineSize: "full", overflow: "hidden" },
						radius: "theme",
					}),
				],
				gap: space({ base: 8, compact: 12, wide: 16 }),
				layout: frameLayout({ y: { base: 12, compact: 16 } }),
			}),
		],
	}),
});
