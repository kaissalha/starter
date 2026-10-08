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
import {
	checkRow,
	hiddenUnlessFeatured,
	planCellLayout,
	planFeature,
	planFeaturesRepeater,
	planItem,
} from "./_shared/plan-parts";

const featured = 1;

const plan = ({ index }: { index: number }): SiteNodeDefinition =>
	flex({
		border: { color: "border", width: 1 },
		children: [
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
												transform: "uppercase",
											}),
										],
										fill: "featured",
										layout: {
											...hiddenUnlessFeatured({ featured: index === featured }),
											inlineSize: "fit-content",
											padding: pad({ x: 3, y: 1.5 }),
										},
									}),
									flex({
										children: [
											text({
												appearance: "heading-sm",
												element: "h3",
												pointer: planItem({ field: "title", index }),
											}),
											flex({
												align: "end",
												children: [
													text({
														appearance: "heading-md",
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
										],
										gap: space(1),
									}),
									text({
										appearance: "body-sm",
										pointer: planItem({ field: "description", index }),
										tone: "muted",
									}),
								],
								gap: space({ base: 4, compact: 3 }),
							}),
							horizontalDivider(),
							flex({
								children: [],
								gap: space(3),
							}),
						],
						gap: space({ base: 8, compact: 6 }),
						layout: {
							padding: pad({
								x: { base: 10, compact: 8, wide: 7 },
								y: { base: 10, compact: 8, wide: 7 },
							}),
						},
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
						layout: {
							padding: pad({
								bottom: { base: 10, compact: 8, wide: 7 },
								top: 0,
								x: { base: 10, compact: 8, wide: 7 },
							}),
						},
					}),
				],
				justify: "between",
				layout: { grow: 1 },
			}),
		],
		fill: index === featured ? "tint" : "canvas",
		layout: { ...planCellLayout, order: index === featured ? { base: -1, wide: 0 } : 0, overflow: "hidden" },
		radius: "theme",
	});

export const pricingEditorialHighlightSection = defineSection({
	category: "pricing",
	pattern: "pricing-editorial-highlight",
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
			createFeature: ({ feature, index }) => checkRow({ pointer: planFeature({ feature, index }) }),
			initial: 6,
			target: "/0/props/children/0/props/children/0/props/children/2/props/children",
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
								gap: space(4),
							}),
						],
						gap: space(2),
						layout: { maxInlineSize: "42rem" },
					}),
					flex({
						children: [],
						direction: { base: "column", wide: "row" },
						gap: space(3),
						layout: { inlineSize: "full" },
					}),
					flex({
						align: "center",
						children: [
							text({ appearance: "body-sm", pointer: "/copy/footer-text", tone: "muted" }),
							{
								props: {
									children: [
										text({
											appearance: "body-sm-em",
											element: "span",
											pointer: "/actions/items/0/label",
											tone: "current",
										}),
									],
									foreground: "primary",
									href: { $link: "/actions/items/0/link" },
								},
								type: "action",
							},
						],
						direction: "row",
						gap: space(1),
						justify: "center",
						wrap: "wrap",
					}),
				],
				gap: space(12),
				layout: frameLayout({ y: { base: 12, compact: 16 } }),
			}),
		],
	}),
});
