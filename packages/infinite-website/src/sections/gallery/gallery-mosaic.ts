import { defineSection } from "../section-definition";
import { contentFrame, flex, grid, mediaAt, sectionBox, text } from "./_shared/section-parts";

const placements = [
	{ base: [1, 2, 1], compact: [1, 2, 1, 2] },
	{ base: [1, 1, 2], compact: [3, 1, 1, 1] },
	{ base: [2, 1, 2], compact: [4, 1, 1, 1] },
	{ base: [1, 2, 3], compact: [3, 2, 2, 1] },
] as const;

export const galleryMosaicSection = defineSection({
	category: "gallery",
	pattern: "gallery-mosaic",
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					flex({
						children: [
							text({
								appearance: "heading-sm",
								element: "h2",
								pointer: "/copy/heading",
								tone: "primary",
							}),
							text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
						],
						gap: "2sp",
					}),
					grid({
						children: placements.map(({ base, compact }, index) =>
							mediaAt({
								index,
								layout: {
									gridColumn: {
										base: { span: base[1], start: base[0] },
										compact: { span: compact[1], start: compact[0] },
									},
									gridRow: {
										base: { span: 1, start: base[2] },
										compact: { span: compact[3], start: compact[2] },
									},
								},
							})
						),
						columns: { base: 2, compact: 4 },
						gap: "3sp",
						layout: {
							aspectRatio: { base: { height: 7, width: 3 }, compact: { height: 1, width: 2 } },
							minBlockSize: 0,
						},
						rows: { base: [{ fraction: 8 }, { fraction: 3 }, { fraction: 3 }], compact: 2 },
					}),
				],
				gap: { base: "8sp", compact: "8sp" },
				padding: { base: "12sp", compact: "16sp" },
			}),
		],
	}),
});
