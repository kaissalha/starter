import type { SiteNodeDefinition } from "../../document/structure-schema";
import { actionButton, box, flex, frameLayout, pad, sectionBox, space, text } from "../metrics/_shared/parts";
import { defineSection } from "../section-definition";
import {
	dotMark,
	planCellLayout,
	planFeature,
	planFeaturesRepeater,
	planItem,
	startRule,
	topRule,
} from "./_shared/plan-parts";

const featured = 1;

const feature = ({ feature: key, index }: { feature: number; index: number }): SiteNodeDefinition =>
	flex({
		children: [
			topRule({ visibility: { base: "removed", compact: "visible" } }),
			flex({
				align: "start",
				children: [dotMark(), text({ appearance: "body-sm", pointer: planFeature({ feature: key, index }) })],
				direction: "row",
				gap: space(1),
			}),
		],
		layout: { padding: pad({ y: { base: 2, compact: 3 } }), position: "relative" },
	});

const plan = ({ index }: { index: number }): SiteNodeDefinition =>
	flex({
		children: [
			flex({
				children: [
					text({ appearance: "label-sm", pointer: planItem({ field: "kicker", index }) }),
					flex({
						align: "end",
						children: [
							text({ appearance: "display-sm", pointer: planItem({ field: "price", index }) }),
							text({
								appearance: "label-sm",
								element: "span",
								pointer: planItem({ field: "suffix", index }),
								tone: "muted",
							}),
						],
						direction: "row",
						gap: space(2),
					}),
					text({ appearance: "body-sm", pointer: planItem({ field: "description", index }), tone: "muted" }),
				],
				gap: space(4),
			}),
			flex({
				children: [],
			}),
			actionButton({
				appearance: index === featured ? "primary" : "outline",
				fullWidth: true,
				labelPointer: planItem({ field: "label", index }),
				linkPointer: planItem({ field: "link", index }),
			}),
			...(index === 0
				? []
				: [
						topRule({ visibility: { base: "visible", wide: "removed" } }),
						startRule({ visibility: { base: "removed", wide: "visible" } }),
					]),
		],
		...(index === featured && { fill: "tint" as const, pattern: "diagonal-slash" as const }),
		gap: space(8),
		layout: {
			...planCellLayout,
			...(index === featured && { order: { base: -1, wide: 0 } }),
			padding: pad({ x: { base: 6, compact: 14, wide: 10 }, y: { base: 12, compact: 16 } }),
			position: "relative",
		},
	});

export const pricingEditorialBorderedSection = defineSection({
	category: "pricing",
	pattern: "pricing-editorial-bordered",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [plan({ index })],
			initial: 3,
			max: 3,
			min: 2,
			target: "/props/children/1/props/children/0/props/children/1/props/children",
		},
		planFeaturesRepeater({
			createFeature: ({ feature: key, index }) => feature({ feature: key, index }),
			initial: 4,
			target: "/0/props/children/1/props/children",
		}),
	],
	root: sectionBox({
		children: [
			flex({
				children: [
					text({ appearance: "heading-sm", element: "h2", pointer: "/copy/heading" }),
					text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
				],
				gap: space(2),
				layout: frameLayout({ bottom: 0, top: 16 }),
			}),
			flex({
				children: [
					box({
						children: [
							box({
								border: { color: "border", width: 1 },
								decorative: true,
								layout: {
									inset: { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 },
									position: "absolute",
									visibility: { base: "removed", wide: "visible" },
								},
								radius: "theme",
							}),
							flex({
								children: [],
								direction: { base: "column", wide: "row" },
								layout: { overflow: { base: "visible", wide: "hidden" } },
								radius: "theme",
							}),
						],
						layout: { position: "relative" },
					}),
				],
				layout: frameLayout({ bottom: { base: 12, compact: 16 }, inline: { base: 0, wide: "6sp" }, top: 8 }),
			}),
		],
	}),
});
