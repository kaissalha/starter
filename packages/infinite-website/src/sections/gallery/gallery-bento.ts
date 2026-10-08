import type { Layout } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { buttons, contentFrame, flex, grid, kicker, mediaAt, sectionBox, text } from "./_shared/section-parts";

const cell = ({
	base,
	compact,
}: {
	base: { column: [number, number]; row: [number, number] };
	compact: { column: [number, number]; row: [number, number] };
}): Layout => ({
	gridColumn: {
		base: { span: base.column[1], start: base.column[0] },
		compact: { span: compact.column[1], start: compact.column[0] },
	},
	gridRow: {
		base: { span: base.row[1], start: base.row[0] },
		compact: { span: compact.row[1], start: compact.row[0] },
	},
});

const cells = [
	cell({ base: { column: [1, 2], row: [1, 1] }, compact: { column: [1, 1], row: [1, 2] } }),
	cell({ base: { column: [1, 1], row: [2, 1] }, compact: { column: [2, 1], row: [1, 1] } }),
	cell({ base: { column: [2, 1], row: [2, 1] }, compact: { column: [3, 1], row: [1, 3] } }),
	cell({ base: { column: [1, 2], row: [3, 1] }, compact: { column: [1, 1], row: [3, 1] } }),
	cell({ base: { column: [1, 2], row: [4, 1] }, compact: { column: [2, 1], row: [2, 2] } }),
];

export const galleryBentoSection = defineSection({
	category: "gallery",
	pattern: "gallery-bento",
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					flex({
						align: "center",
						children: [
							kicker({ align: "center" }),
							flex({
								align: "center",
								children: [
									text({
										align: "center",
										appearance: "display-sm",
										element: "h2",
										layout: { maxInlineSize: "42rem" },
										pointer: "/copy/heading",
										tone: "primary",
									}),
									flex({
										align: "center",
										children: [
											text({
												align: "center",
												appearance: "body-md",
												pointer: "/copy/description",
												tone: "muted",
											}),
											buttons(),
										],
										gap: "6sp",
										layout: { maxInlineSize: "36rem" },
									}),
								],
								gap: "6sp",
							}),
						],
						gap: "4sp",
					}),
					grid({
						children: cells.map((layout, index) => mediaAt({ index, layout })),
						columns: { base: 2, compact: 3 },
						gap: "3sp",
						layout: { blockSize: { base: "840px", wide: "1260px" } },
						rows: { base: 4, compact: 3 },
					}),
				],
				gap: { base: "8sp", compact: "12sp" },
				padding: { base: "12sp", compact: "16sp" },
			}),
		],
	}),
});
