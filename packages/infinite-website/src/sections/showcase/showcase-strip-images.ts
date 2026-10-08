import { box, contentFrame, flex, grid, kicker, media, sectionBox, text } from "../gallery/_shared/section-parts";
import { defineSection } from "../section-definition";

const decorative = flex({
	children: [
		media({ aspectRatio: { height: 1, width: 1 }, layout: { inlineSize: "115px" }, pointer: "/images/items/0" }),
		media({
			aspectRatio: { height: 1, width: 1 },
			layout: { inlineSize: "44sp", margin: { base: { inlineStart: "115px" } } },
			pointer: "/images/items/1",
		}),
	],
	layout: { shrink: 0, visibility: { base: "removed", compact: "visible" } },
});

const laptopColumns = { base: 1, wide: ["232px", { fraction: 1 }] };

export const showcaseStripImagesSection = defineSection({
	category: "showcase",
	pattern: "showcase-strip-images",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					align: "center",
					children: [
						media({
							fill: "transparent",
							fit: "contain",
							hoverOpacity: 1,
							imageOpacity: 0.5,
							layout: { blockSize: "full", inlineSize: "full" },
							pointer: `/items/items/${index}`,
							radius: "none",
						}),
					],
					fill: "tint",
					fillOpacity: { base: 1, compact: 0 },
					justify: "center",
					layout: {
						aspectRatio: { height: 1, width: 1 },
						padding: { base: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "8sp", inlineStart: "8sp" } },
					},
					radius: "theme",
				}),
			],
			initial: 10,
			max: 20,
			min: 5,
			target: "/props/children/0/props/children/1/props/children/1/props/children",
		},
	],
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					flex({
						align: "end",
						children: [
							grid({
								align: "start",
								children: [
									kicker(),
									flex({
										children: [
											text({
												appearance: "display-md",
												element: "h2",
												pointer: "/copy/heading",
												tone: "primary",
											}),
											text({
												appearance: "body-md",
												pointer: "/copy/description",
												tone: "muted",
											}),
										],
										gap: "4sp",
										layout: { maxInlineSize: "36rem" },
									}),
								],
								columnGap: { base: "6sp", wide: "0" },
								columns: laptopColumns,
								gap: "6sp",
							}),
							decorative,
						],
						direction: "row",
						justify: "between",
					}),
					grid({
						children: [
							box({ layout: { visibility: { base: "removed", wide: "visible" } } }),
							grid({ children: [], columns: { base: 2, compact: 3, wide: 5 }, gap: "4sp" }),
						],
						columnGap: { base: "6sp", wide: "0" },
						columns: laptopColumns,
						gap: "6sp",
					}),
				],
				gap: "16sp",
				padding: { base: "16sp", compact: "20sp" },
			}),
		],
	}),
});
