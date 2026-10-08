import { defineSection } from "../section-definition";
import { box, contentFrame, flex, grid, mediaAt, sectionBox, text } from "./_shared/section-parts";

const slots = [
	[1, 2, 1],
	[1, 1, 2],
	[2, 2, 2],
	[1, 2, 3],
	[3, 1, 1],
	[3, 2, 3],
	[4, 1, 1],
	[4, 1, 2],
] as const;

const divider = () => box({ fill: "border", layout: { blockSize: "8sp", inlineSize: 1 } });

export const galleryBentoEditorialSection = defineSection({
	category: "gallery",
	pattern: "gallery-bento-editorial",
	root: sectionBox({
		children: [
			contentFrame({
				align: "center",
				children: [
					divider(),
					flex({
						align: "center",
						children: [
							text({
								align: "center",
								appearance: "heading-sm",
								element: "h2",
								pointer: "/copy/heading",
								tone: "primary",
							}),
							text({
								align: "center",
								appearance: "body-sm",
								layout: { maxInlineSize: "24rem" },
								pointer: "/copy/description",
								tone: "muted",
							}),
						],
						gap: "4sp",
						layout: { maxInlineSize: "36rem" },
					}),
					divider(),
				],
				gap: { base: "4sp", compact: "3sp" },
				padding: { base: "20sp", compact: "24sp" },
			}),
			box({
				children: [
					grid({
						children: slots.map(([row, rowSpan, column], index) =>
							mediaAt({
								index,
								layout: {
									gridColumn: { span: 1, start: column },
									gridRow: { span: rowSpan, start: row },
								},
							})
						),
						columns: 3,
						gap: "3sp",
						layout: { blockSize: "full", inlineSize: "full" },
						rows: 4,
					}),
				],
				layout: {
					aspectRatio: { base: { height: 4, width: 3 }, compact: { height: 9, width: 14 } },
					inlineSize: "full",
					padding: { base: { blockEnd: "3sp", blockStart: "3sp", inlineEnd: "3sp", inlineStart: "3sp" } },
				},
			}),
		],
	}),
});
