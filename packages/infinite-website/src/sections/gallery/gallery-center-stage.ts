import { defineSection } from "../section-definition";
import { box, buttons, contentFrame, flex, kicker, mediaAt, sectionBox, text } from "./_shared/section-parts";

const control = (kind: "next" | "previous") =>
	({
		appearance: { border: { color: "border", width: 1 }, foreground: "primary", radius: "theme" },
		corners: "square",
		icon: "arrow",
		iconSize: "1rem",
		kind,
		label: { $text: "/accessibility/carouselLabel" },
		size: { base: "11sp", compact: "8sp" },
	}) as const;

export const galleryCenterStageSection = defineSection({
	category: "gallery",
	pattern: "gallery-center-stage",
	repeaters: [
		{
			collection: "/media",
			createValues: ({ index }) => [
				mediaAt({
					aspectRatio: { height: 1, width: 1 },
					index,
					layout: { inlineSize: "full" },
					radius: "none",
				}),
			],
			initial: 6,
			max: 12,
			min: 6,
			target: "/props/children/1/props/children/0/props/slides",
		},
	],
	root: sectionBox({
		children: [
			contentFrame({
				align: "center",
				children: [
					kicker({ align: "center", tone: "muted" }),
					flex({
						align: "center",
						children: [
							text({
								align: "center",
								appearance: "display-sm",
								element: "h2",
								layout: { maxInlineSize: "600px" },
								pointer: "/copy/heading",
								tone: "muted",
							}),
							flex({
								align: "center",
								children: [
									text({
										align: "center",
										appearance: "body-md",
										layout: { maxInlineSize: "600px" },
										pointer: "/copy/description",
										tone: "muted",
									}),
									buttons(),
								],
								gap: "8sp",
							}),
						],
						gap: "8sp",
					}),
				],
				gap: "6sp",
				layout: {
					padding: {
						base: { blockEnd: "12sp", blockStart: "16sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
						compact: { blockEnd: "12sp", blockStart: "20sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
					},
				},
				padding: { base: "0" },
			}),
			box({
				children: [
					{
						props: {
							controlGroups: [
								{
									align: "center",
									controls: [control("previous"), control("next")],
									gap: "0",
									placement: "after",
								},
							],
							controlsGap: { base: "12sp", wide: "8sp" },
							gap: { base: 0, compact: "6sp" },
							label: { $text: "/accessibility/carouselLabel" },
							options: { align: "center", containScroll: false, loop: true },
							slideBasis: { base: "85%", compact: "33.3333%", wide: "22%" },
							slideEffect: {
								aspectRatio: { center: 320 / 354, edge: 1, side: 16 / 9 },
								opacity: { side: 0.4 },
							},
							slides: [],
							slideSizing: "exact",
							viewportLayout: { inlineSize: "full", margin: { inlineEnd: 0, inlineStart: 0 } },
						},
						type: "carousel",
					},
				],
				layout: { padding: { base: { blockEnd: "16sp" }, compact: { blockEnd: "20sp" } } },
			}),
		],
	}),
});
