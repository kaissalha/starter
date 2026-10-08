import { box, contentFrame, flex, text } from "../gallery/_shared/section-parts";
import { defineSection } from "../section-definition";

export const showcaseTextCarouselSection = defineSection({
	category: "showcase",
	pattern: "showcase-text-carousel",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				box({
					children: [
						flex({
							align: "center",
							children: [
								text({
									align: "center",
									appearance: "label-md",
									pointer: `/items/items/${index}/name`,
									tone: "primary",
								}),
							],
							justify: "center",
							layout: {
								padding: {
									base: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "4sp", inlineStart: "4sp" },
									compact: {
										blockEnd: "10sp",
										blockStart: "10sp",
										inlineEnd: "4sp",
										inlineStart: "4sp",
									},
								},
							},
						}),
						box({
							fill: "border",
							layout: {
								blockSize: "full",
								inlineSize: "1px",
								inset: { blockStart: 0, inlineStart: 0 },
								position: "absolute",
								visibility: { base: "removed", compact: "visible" },
							},
						}),
					],
					layout: { position: "relative" },
				}),
			],
			initial: 6,
			max: 12,
			min: 6,
			target: "/props/children/0/props/children/0/props/slides",
		},
	],
	root: {
		props: {
			border: { color: "border", sides: ["block-start", "block-end"], width: 1 },
			children: [
				contentFrame({
					children: [
						{
							props: {
								controlGroups: [],
								gap: 0,
								label: { $text: "/accessibility/carouselLabel" },
								options: { align: "start", containScroll: "trim-snaps", loop: false },
								slideBasis: { base: "33.3333%", compact: "25%", wide: "16.6667%" },
								slides: [],
								slideSizing: "exact",
								viewportLayout: { inlineSize: "full", margin: { inlineEnd: 0, inlineStart: 0 } },
							},
							type: "carousel",
						},
					],
					padding: { base: "0" },
				}),
			],
			fill: "canvas",
		},
		type: "box",
	},
});
