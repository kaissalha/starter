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

const badge = ({ index }: { index: number }): SiteNodeDefinition =>
	flex({
		border: { color: "border", width: 1 },
		children: [
			text({
				align: "center",
				appearance: "body-sm",
				element: "span",
				pointer: planItem({ field: "badge-label", index }),
			}),
		],
		fill: "featured",
		layout: {
			inset: { blockEnd: "100%", inlineEnd: 0, inlineStart: 0 },
			padding: pad({ x: 6, y: 2 }),
			position: "absolute",
			visibility: index === featured ? { base: "removed", wide: "visible" } : "removed",
		},
		radius: "theme",
	});

const inFlowBadge = ({ index }: { index: number }): SiteNodeDefinition =>
	flex({
		children: [
			flex({
				children: [
					text({
						align: "center",
						appearance: "body-sm",
						element: "span",
						pointer: planItem({ field: "badge-label", index }),
					}),
				],
				fill: "featured",
				layout: { padding: pad({ x: 6, y: 2 }) },
			}),
			horizontalDivider(),
		],
		layout: { visibility: index === featured ? { base: "visible", wide: "removed" } : "removed" },
	});

const plan = ({ index }: { index: number }): SiteNodeDefinition =>
	flex({
		children: [
			badge({ index }),
			flex({
				border: { color: "border", width: 1 },
				children: [
					inFlowBadge({ index }),
					flex({
						children: [
							flex({
								children: [
									text({
										appearance: "heading-sm",
										element: "h3",
										pointer: planItem({ field: "title", index }),
									}),
									text({ appearance: "heading-md", pointer: planItem({ field: "price", index }) }),
									text({
										appearance: "body-sm",
										pointer: planItem({ field: "description", index }),
										tone: "muted",
									}),
								],
								gap: space(4),
							}),
							actionButton({
								appearance: index === featured ? "primary" : "outline",
								fullWidth: true,
								labelPointer: planItem({ field: "label", index }),
								linkPointer: planItem({ field: "link", index }),
							}),
							flex({
								children: [],
								gap: space(3),
							}),
						],
						gap: space(6),
						layout: { padding: pad({ x: { base: 8, compact: 6 }, y: { base: 8, compact: 6 } }) },
					}),
				],
				fill: index === featured ? "tint" : "canvas",
				layout: { grow: 1 },
				radius: "theme",
			}),
		],
		layout: { ...planCellLayout, order: index === featured ? { base: -1, wide: 0 } : 0, position: "relative" },
	});

export const pricingTableSection = defineSection({
	category: "pricing",
	pattern: "pricing-table",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [plan({ index })],
			initial: 4,
			max: 4,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
		planFeaturesRepeater({
			createFeature: ({ feature, index }) => checkRow({ pointer: planFeature({ feature, index }) }),
			target: "/0/props/children/1/props/children/1/props/children/2/props/children",
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
							text({ align: "center", appearance: "label-md", pointer: "/copy/kicker", tone: "muted" }),
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
								gap: space(6),
							}),
						],
						gap: space(4),
						layout: { maxInlineSize: "42rem" },
					}),
					flex({
						children: [],
						direction: { base: "column", wide: "row" },
						gap: space(4),
						layout: { inlineSize: "full" },
					}),
				],
				gap: space({ base: 8, compact: 12, wide: 16 }),
				layout: frameLayout({ y: { base: 12, compact: 16 } }),
			}),
		],
	}),
});
