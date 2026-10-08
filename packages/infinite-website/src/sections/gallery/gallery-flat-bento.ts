import { defineSection } from "../section-definition";
import { box, contentFrame, flex, mediaAt, sectionBox } from "./_shared/section-parts";
import { splitHeader } from "./_shared/split-header";

const sizes = [
	{ base: [203, 203], compact: [392, 392] },
	{ base: [147, 147], compact: [285, 285] },
	{ base: [148, 248], compact: [288, 480] },
	{ base: [202, 203], compact: [392, 392] },
	{ base: [147, 147], compact: [285, 285] },
] as const;

export const galleryFlatBentoSection = defineSection({
	category: "gallery",
	pattern: "gallery-flat-bento",
	root: sectionBox({
		children: [
			flex({
				children: [
					contentFrame({
						children: [splitHeader({ center: true, hasKicker: false })],
						padding: { base: "0" },
					}),
					box({
						children: [
							flex({
								align: "end",
								children: sizes.map(({ base, compact }, index) =>
									mediaAt({
										index,
										layout: {
											blockSize: { base: base[1], compact: compact[1] },
											inlineSize: { base: base[0], compact: compact[0] },
											shrink: 0,
										},
									})
								),
								direction: "row",
								gap: "4sp",
								layout: {
									inlineSize: "max-content",
									inset: { inlineStart: "50%" },
									position: "relative",
									translate: { base: { inline: "-50%" } },
								},
							}),
						],
						layout: { inlineSize: "full", overflow: "hidden" },
					}),
				],
				gap: "12sp",
				layout: {
					padding: {
						base: { blockEnd: "16sp", blockStart: "16sp" },
						compact: { blockEnd: "20sp", blockStart: "20sp" },
					},
				},
			}),
		],
	}),
});
