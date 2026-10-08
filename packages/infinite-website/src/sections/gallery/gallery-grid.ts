import { defineSection } from "../section-definition";
import { contentFrame, grid, mediaAt, sectionBox } from "./_shared/section-parts";
import { splitHeader } from "./_shared/split-header";

export const galleryGridSection = defineSection({
	category: "gallery",
	pattern: "gallery-grid",
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					splitHeader({ center: false, hasButtons: false }),
					grid({
						children: Array.from({ length: 6 }, (_, index) =>
							mediaAt({
								index,
								layout: { blockSize: { base: "50sp", compact: "85sp" }, inlineSize: "full" },
							})
						),
						columns: { base: 2, wide: 3 },
						gap: "3sp",
					}),
				],
				gap: { base: "8sp", compact: "12sp" },
				padding: { base: "12sp", compact: "16sp" },
			}),
		],
	}),
});
