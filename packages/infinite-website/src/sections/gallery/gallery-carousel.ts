import { defineSection } from "../section-definition";
import { buttons, contentFrame, flex, kicker, mediaAt, sectionBox, text } from "./_shared/section-parts";

const centered = { margin: { inlineEnd: "auto", inlineStart: "auto" }, maxInlineSize: "42rem" } as const;

export const galleryCarouselSection = defineSection({
	category: "gallery",
	pattern: "gallery-carousel",
	repeaters: [
		{
			collection: "/media",
			createValues: ({ index }) => [
				mediaAt({ aspectRatio: { height: 1, width: 1 }, index, layout: { inlineSize: "full" } }),
			],
			initial: 5,
			max: 10,
			min: 5,
			target: "/props/children/0/props/children/1/props/slides",
		},
	],
	root: sectionBox({
		children: [
			flex({
				children: [
					contentFrame({
						children: [
							flex({
								align: "center",
								children: [
									kicker({ align: "center" }),
									flex({
										children: [
											text({
												align: "center",
												appearance: "display-sm",
												element: "h2",
												layout: centered,
												pointer: "/copy/heading",
												tone: "primary",
											}),
											flex({
												children: [
													text({
														align: "center",
														appearance: "body-md",
														layout: centered,
														pointer: "/copy/description",
														tone: "muted",
													}),
													buttons(),
												],
												gap: "6sp",
											}),
										],
										gap: "6sp",
									}),
								],
								gap: "4sp",
							}),
						],
						padding: { base: "0" },
					}),
					{
						props: {
							controlGroups: [],
							gap: "3sp",
							label: { $text: "/accessibility/carouselLabel" },
							marquee: { pauseOnHover: true, speed: 0.7 },
							options: { align: "start", draggable: false, loop: true },
							slideBasis: { base: "100%", compact: "33.3333%", wide: "25%" },
							slides: [],
							slideSizing: "exact",
							viewportLayout: {
								inlineSize: "full",
								margin: { inlineEnd: 0, inlineStart: 0 },
							},
						},
						type: "carousel",
					},
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
