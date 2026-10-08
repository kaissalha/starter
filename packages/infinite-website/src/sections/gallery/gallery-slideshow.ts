import { defineSection } from "../section-definition";
import { contentFrame, mediaAt, sectionBox } from "./_shared/section-parts";
import { splitHeader } from "./_shared/split-header";

export const gallerySlideshowSection = defineSection({
	category: "gallery",
	pattern: "gallery-slideshow",
	repeaters: [
		{
			collection: "/media",
			createValues: ({ index }) => [
				mediaAt({ aspectRatio: { height: 7, width: 14 }, index, layout: { inlineSize: "full" } }),
			],
			initial: 3,
			max: 8,
			min: 1,
			target: "/props/children/0/props/children/1/props/slides",
		},
	],
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					splitHeader({ center: true }),
					{
						props: {
							autoplay: { delay: 5000 },
							controlGroups: [
								{
									align: "center",
									controls: [
										{
											active: { blockSize: "2sp", inlineSize: "2sp", opacity: 1 },
											appearance: {
												fill: "tint",
												padding: {
													blockEnd: "2.5sp",
													blockStart: "2.5sp",
													inlineEnd: "2.5sp",
													inlineStart: "2.5sp",
												},
												radius: "full",
											},
											inactive: { blockSize: "1.5sp", inlineSize: "1.5sp", opacity: 0.4 },
											kind: "indicators",
											label: { $text: "/accessibility/carouselLabel" },
											spacing: "1.5sp",
										},
									],
									placement: "after",
								},
							],
							controlsGap: { base: "4sp", compact: "6sp", wide: "8sp" },
							gap: "4sp",
							label: { $text: "/accessibility/carouselLabel" },
							options: { align: "start", containScroll: false },
							slideBasis: "100%",
							slides: [],
							viewportLayout: { inlineSize: "full", margin: { inlineEnd: 0, inlineStart: 0 } },
						},
						type: "carousel",
					},
				],
				gap: { base: "8sp", compact: "12sp" },
				padding: { base: "16sp", compact: "20sp" },
			}),
		],
	}),
});
