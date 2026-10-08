import { box, contentFrame, flex, media, sectionBox, text } from "../gallery/_shared/section-parts";
import { defineSection } from "../section-definition";

export const showcaseCarouselSection = defineSection({
	category: "showcase",
	pattern: "showcase-carousel",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					align: "center",
					children: [
						flex({
							align: "center",
							children: [
								media({
									fill: "transparent",
									filter: "silhouette",
									fit: "contain",
									imageOpacity: 0.65,
									layout: { blockSize: "full", inlineSize: "full" },
									pointer: `/items/items/${index}`,
									radius: "none",
								}),
							],
							justify: "center",
							layout: {
								blockSize: "16sp",
								inlineSize: "32sp",
								padding: {
									base: { blockEnd: "4sp", blockStart: "4sp", inlineEnd: "4sp", inlineStart: "4sp" },
								},
							},
						}),
						box({
							fill: "border",
							layout: {
								blockSize: "1sp",
								inlineSize: "1sp",
								margin: { base: { inlineEnd: "4sp", inlineStart: "4sp" } },
							},
							opacity: 0.5,
							radius: "theme",
						}),
					],
					direction: "row",
				}),
			],
			initial: 8,
			max: 16,
			min: 6,
			target: "/props/children/0/props/children/1/props/slides",
		},
	],
	root: sectionBox({
		children: [
			flex({
				children: [
					contentFrame({
						align: "center",
						children: [
							text({
								align: "center",
								appearance: "title-sm",
								element: "h2",
								layout: { maxInlineSize: "42rem" },
								pointer: "/copy/heading",
								tone: "muted",
							}),
						],
						padding: { base: "0" },
					}),
					{
						props: {
							controlGroups: [],
							edgeFade: { size: "8%" },
							gap: 0,
							label: { $text: "/accessibility/carouselLabel" },
							marquee: { pauseOnHover: true, speed: 0.7 },
							options: { align: "start", draggable: false, loop: true },
							slideBasis: "41sp",
							slides: [],
							slideSizing: "exact",
							viewportLayout: { inlineSize: "full", margin: { inlineEnd: 0, inlineStart: 0 } },
						},
						type: "carousel",
					},
				],
				gap: { base: "6sp", compact: "8sp" },
				layout: {
					padding: {
						base: { blockEnd: "8sp", blockStart: "8sp" },
						compact: { blockEnd: "10sp", blockStart: "10sp" },
					},
				},
			}),
		],
	}),
});
