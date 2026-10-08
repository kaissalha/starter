import { defineSection } from "../section-definition";
import { flex, itemMedia, kicker, sectionShell, symmetric, text } from "../team/_shared/nodes";
import { carousel, controlGroup, nextControl, previousControl } from "./_shared/durable-carousel";

const pill = { fill: "tint", foreground: "primary", radius: "full" } as const;

const createTestimonial = ({ index }: { index: number }) =>
	flex({
		children: [
			text({
				appearance: "heading-lg",
				layout: { maxInlineSize: "64.75rem" },
				pointer: `/testimonials/items/${index}/quote`,
				style: "italic",
			}),
			flex({
				align: "center",
				children: [
					itemMedia({
						collection: "testimonials",
						index,
						layout: {
							aspectRatio: { height: 1, width: 1 },
							blockSize: "11sp",
							inlineSize: "11sp",
							shrink: 0,
						},
						radius: "full",
					}),
					flex({
						children: [
							text({ appearance: "body-sm-em", pointer: `/testimonials/items/${index}/name` }),
							text({
								appearance: "body-sm",
								pointer: `/testimonials/items/${index}/title`,
								tone: "muted",
							}),
						],
						direction: "column",
						gap: "1sp",
						layout: { inlineSize: "35sp" },
					}),
				],
				direction: "row",
				gap: "5sp",
				layout: { inlineSize: "full", maxInlineSize: "28.625rem" },
			}),
		],
		direction: "column",
		gap: "16sp",
		layout: { padding: { base: { blockEnd: "1sp", blockStart: "1sp", inlineEnd: "1sp", inlineStart: "1sp" } } },
	});

export const testimonialSingleCarouselSection = defineSection({
	category: "testimonials",
	pattern: "testimonial-single-carousel",
	repeaters: [
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createTestimonial({ index })],
			initial: 6,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/slides",
		},
	],
	root: sectionShell({
		children: [
			flex({
				children: [
					kicker({ pointer: "/copy/kicker" }),
					text({
						appearance: "display-sm",
						element: "h2",
						layout: { maxInlineSize: "36rem" },
						pointer: "/copy/heading",
					}),
				],
				direction: "column",
				gap: "4sp",
			}),
			carousel({
				controlGroups: [
					controlGroup({
						controls: [
							previousControl({ appearance: pill }),
							nextControl({ appearance: pill }),
							{
								appearance: {
									...pill,
									appearance: "body-sm",
									padding: {
										blockEnd: "1sp",
										blockStart: "1sp",
										inlineEnd: "3sp",
										inlineStart: "3sp",
									},
								},
								kind: "counter",
								pad: 2,
								separator: "—",
							},
						],
						gap: "1rem",
						layout: { margin: { blockStart: "-1rem" } },
					}),
				],
				gap: "3sp",
				slideBasis: "100%",
			}),
		],
		gap: "12sp",
		padding: { base: symmetric({ value: "16sp" }), compact: symmetric({ value: "20sp" }) },
	}),
});
