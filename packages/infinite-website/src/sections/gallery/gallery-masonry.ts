import { defineSection } from "../section-definition";
import { contentFrame, grid, mediaAt, sectionBox } from "./_shared/section-parts";

type Cell = readonly [column: number, columnSpan: number, row: number, rowSpan: number];

const placements: ReadonlyArray<readonly [base: Cell, compact: Cell, wide: Cell]> = [
	[
		[1, 2, 1, 1],
		[1, 4, 1, 5],
		[2, 3, 1, 6],
	],
	[
		[1, 1, 2, 1],
		[1, 4, 6, 3],
		[1, 2, 7, 4],
	],
	[
		[2, 1, 2, 1],
		[1, 6, 9, 4],
		[3, 2, 7, 6],
	],
	[
		[1, 2, 3, 1],
		[5, 4, 1, 8],
		[5, 4, 1, 12],
	],
	[
		[1, 1, 4, 1],
		[9, 4, 1, 4],
		[9, 3, 1, 5],
	],
	[
		[2, 1, 4, 1],
		[9, 4, 5, 4],
		[9, 4, 6, 4],
	],
	[
		[1, 2, 5, 1],
		[7, 6, 9, 4],
		[9, 2, 10, 3],
	],
];

const column = ([start, span]: Cell) => ({ span, start });

const row = ([, , start, span]: Cell) => ({ span, start });

export const galleryMasonrySection = defineSection({
	category: "gallery",
	pattern: "gallery-masonry",
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					grid({
						children: placements.map(([base, compact, wide], index) =>
							mediaAt({
								index,
								layout: {
									gridColumn: { base: column(base), compact: column(compact), wide: column(wide) },
									gridRow: { base: row(base), compact: row(compact), wide: row(wide) },
								},
							})
						),
						columns: { base: 2, compact: 12 },
						gap: { base: "3sp", compact: "4sp" },
						layout: {
							aspectRatio: {
								base: { height: 5, width: 2 },
								compact: { height: 3, width: 4 },
								wide: { height: 2, width: 3 },
							},
							minBlockSize: 0,
						},
						rows: { base: 5, compact: 12 },
					}),
				],
				padding: { base: "12sp", compact: "16sp" },
			}),
		],
	}),
});
