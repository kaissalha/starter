import { defineSection } from "../section-definition";
import { flex, itemMedia, kicker, sectionShell, text } from "../team/_shared/nodes";
import { carousel, controlGroup, nextControl, previousControl } from "./_shared/durable-carousel";

const arrow = { fill: "tint", foreground: "primary", radius: "theme" } as const;

const arrowStyle = { corners: "square", iconSize: "5sp", size: "11sp" } as const;

const createTestimonial = ({ index }: { index: number }) =>
	flex({
		align: "stretch",
		children: [
			text({ appearance: "body-lg", pointer: `/testimonials/items/${index}/quote` }),
			flex({
				align: "center",
				children: [
					flex({
						children: [
							text({ appearance: "title-sm", pointer: `/testimonials/items/${index}/name` }),
							text({
								appearance: "body-sm",
								pointer: `/testimonials/items/${index}/title`,
								tone: "muted",
								transform: "uppercase",
							}),
						],
						direction: "column",
						gap: "2sp",
					}),
					itemMedia({
						collection: "testimonials",
						index,
						layout: {
							aspectRatio: { height: 1, width: 1 },
							blockSize: { base: "16sp", compact: "12sp" },
							inlineSize: { base: "16sp", compact: "12sp" },
							shrink: 0,
						},
					}),
				],
				direction: "row",
				gap: "4sp",
				justify: "between",
			}),
		],
		direction: "column",
		fill: "tint",
		gap: "12sp",
		justify: "between",
		layout: {
			blockSize: "full",
			padding: {
				base: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" },
				compact: { blockEnd: "10sp", blockStart: "10sp", inlineEnd: "10sp", inlineStart: "10sp" },
			},
		},
		radius: "theme",
	});

export const testimonialCarouselCardSection = defineSection({
	category: "testimonials",
	pattern: "testimonial-carousel-card",
	repeaters: [
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createTestimonial({ index })],
			initial: 4,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/0/props/slides",
		},
	],
	root: sectionShell({
		children: [
			carousel({
				controlGroups: [
					controlGroup({
						controls: [
							previousControl({
								appearance: arrow,
								visibility: { base: "removed", compact: "visible" },
								...arrowStyle,
							}),
							nextControl({
								appearance: arrow,
								visibility: { base: "removed", compact: "visible" },
								...arrowStyle,
							}),
						],
						gap: "3sp",
						placement: "header",
					}),
					controlGroup({
						controls: [
							previousControl({
								appearance: arrow,
								visibility: { base: "visible", compact: "removed" },
								...arrowStyle,
							}),
							nextControl({
								appearance: arrow,
								visibility: { base: "visible", compact: "removed" },
								...arrowStyle,
							}),
						],
						gap: "3sp",
					}),
				],
				controlsGap: "12sp",
				gap: "3sp",
				header: {
					align: { base: "stretch", compact: "end" },
					children: [
						flex({
							children: [
								kicker({ pointer: "/copy/kicker" }),
								text({
									appearance: "display-sm",
									element: "h2",
									pointer: "/copy/heading",
								}),
							],
							direction: "column",
							gap: "4sp",
							layout: { maxInlineSize: { base: "full", compact: "50%" } },
						}),
					],
					direction: { base: "column", compact: "row" },
					gap: "12sp",
					justify: "between",
				},
				slideBasis: { base: "87.5%", compact: "75%", wide: "55.5556%" },
				viewportLayout: { inlineSize: "full", margin: { inlineEnd: 0, inlineStart: 0 }, overflow: "visible" },
			}),
		],
		padding: { base: { blockEnd: "16sp", blockStart: "16sp" }, compact: { blockEnd: "20sp", blockStart: "20sp" } },
		rootLayout: { overflow: "clip" },
	}),
});
