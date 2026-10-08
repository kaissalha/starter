import type { SiteNodeDefinition } from "../../document/structure-schema";
import {
	actionButton,
	flex,
	frameLayout,
	horizontalDivider,
	pad,
	sectionBox,
	space,
	text,
} from "../metrics/_shared/parts";
import { defineSection } from "../section-definition";
import { checkRow, planCellLayout, planFeature, planFeaturesRepeater, planItem } from "./_shared/plan-parts";

const featured = 1;

const plan = ({ index }: { index: number }): SiteNodeDefinition =>
	flex({
		children: [
			flex({
				children: [
					flex({
						children: [
							flex({
								children: [
									text({
										appearance: "label-sm",
										element: "span",
										pointer: planItem({ field: "badge-label", index }),
									}),
								],
								fill: "featured",
								layout: {
									inlineSize: "fit-content",
									padding: pad({ x: 2.5, y: 1 }),
									...(index !== featured && { visibility: "removed" as const }),
								},
								radius: "full",
							}),
							text({
								appearance: "heading-sm",
								element: "h3",
								pointer: planItem({ field: "title", index }),
							}),
							text({
								appearance: "body-sm",
								pointer: planItem({ field: "description", index }),
								tone: "muted",
							}),
						],
						fill: "tint",
						gap: space(2),
						layout: {
							minBlockSize: index === featured ? "44sp" : "36sp",
							padding: pad({ x: 8, y: 7 }),
						},
						radius: "theme",
					}),
					flex({
						children: [
							flex({
								children: [
									flex({
										align: "end",
										children: [
											text({
												appearance: "display-sm",
												pointer: planItem({ field: "price", index }),
											}),
											text({
												appearance: "body-sm",
												element: "span",
												pointer: planItem({ field: "period", index }),
												tone: "muted",
											}),
										],
										direction: "row",
										gap: space(1),
										wrap: "wrap",
									}),
									actionButton({
										appearance: index === featured ? "primary" : "outline",
										fullWidth: true,
										labelPointer: planItem({ field: "label", index }),
										linkPointer: planItem({ field: "link", index }),
									}),
								],
								gap: space(4),
							}),
							flex({
								children: [
									horizontalDivider(),
									text({
										appearance: "label-sm",
										element: "span",
										pointer: planItem({ field: "features-label", index }),
										tone: "muted",
										transform: "uppercase",
									}),
									flex({
										children: [],
										gap: space(2),
									}),
								],
								gap: space(2),
							}),
						],
						gap: space(6),
						layout: { padding: pad({ x: 8 }) },
					}),
				],
				fill: "tint",
				gap: space(6),
				layout: { grow: 1, overflow: "hidden", padding: pad({ bottom: 8, top: 1, x: 1 }) },
				radius: "theme",
			}),
		],
		layout: {
			...planCellLayout,
			...(index === featured && { margin: { base: { blockStart: 0 }, wide: { blockStart: "-8sp" } } }),
		},
	});

export const pricingTable2Section = defineSection({
	category: "pricing",
	pattern: "pricing-table-2",
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
				checkRow({ pointer: planFeature({ feature, index }), tone: "muted" }),
			initial: 4,
			target: "/0/props/children/0/props/children/1/props/children/1/props/children/2/props/children",
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
							text({
								align: "center",
								appearance: "display-sm",
								element: "h2",
								pointer: "/copy/heading",
							}),
							text({
								align: "center",
								appearance: "body-md",
								pointer: "/copy/description",
								tone: "muted",
							}),
						],
						gap: space(4),
						layout: { maxInlineSize: "42rem" },
					}),
					flex({
						children: [],
						direction: { base: "column", wide: "row" },
						gap: space(4),
						layout: {
							inlineSize: "full",
							maxInlineSize: "80rem",
							padding: { base: { blockStart: 0 }, wide: { blockStart: "8sp" } },
						},
					}),
				],
				gap: space(12),
				layout: frameLayout({ y: { base: 20, compact: 24 } }),
			}),
		],
	}),
});
