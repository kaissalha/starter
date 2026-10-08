import { defineSection } from "../section-definition";
import { button, flex, itemMedia, kicker, sectionShell, text } from "../team/_shared/nodes";
import { carousel, controlGroup, indicatorsControl, nextControl, previousControl } from "./_shared/durable-carousel";

const arrow = { border: { color: "current", width: "1px" }, fill: "transparent", radius: "none" } as const;

const arrowVisibility = { base: "removed", compact: "visible" } as const;

const createTestimonial = ({ index }: { index: number }) =>
	flex({
		children: [
			{ props: { name: "quote", size: "1.5rem", tone: "accent-text" }, type: "icon" },
			flex({
				children: [
					text({ appearance: "body-md", pointer: `/testimonials/items/${index}/quote`, tone: "muted" }),
					flex({
						align: "center",
						children: [
							itemMedia({
								collection: "testimonials",
								index,
								layout: {
									aspectRatio: { height: 1, width: 1 },
									blockSize: "12sp",
									inlineSize: "12sp",
									shrink: 0,
								},
								radius: "full",
							}),
							flex({
								children: [
									text({ appearance: "body-md", pointer: `/testimonials/items/${index}/name` }),
									text({
										appearance: "body-sm",
										pointer: `/testimonials/items/${index}/title`,
										tone: "muted",
									}),
								],
								direction: "column",
							}),
						],
						direction: "row",
						gap: "4sp",
					}),
				],
				direction: "column",
				gap: "8sp",
				justify: "between",
				layout: { grow: 1 },
			}),
		],
		direction: { base: "column", compact: "row" },
		fill: "tint",
		gap: "8sp",
		layout: {
			inlineSize: "full",
			minBlockSize: { base: "128sp", compact: "96sp" },
			padding: { base: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "8sp", inlineStart: "8sp" } },
		},
		radius: "theme",
	});

export const testimonialCarouselSection = defineSection({
	category: "testimonials",
	pattern: "testimonial-carousel",
	repeaters: [
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createTestimonial({ index })],
			initial: 5,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/slides",
		},
	],
	root: sectionShell({
		children: [
			flex({
				align: { base: "stretch", wide: "end" },
				children: [
					flex({
						children: [
							kicker({ pointer: "/copy/kicker" }),
							text({ appearance: "display-sm", element: "h2", pointer: "/copy/heading" }),
						],
						direction: "column",
						gap: "4sp",
						layout: { maxInlineSize: "48rem" },
					}),
					flex({
						align: { base: "stretch", wide: "end" },
						children: [button({ index: 0, variant: "outline" })],
						direction: "column",
						gap: "4sp",
						layout: { inlineSize: { base: "full", wide: "50%" } },
					}),
				],
				direction: { base: "column", wide: "row" },
				gap: "8sp",
				justify: "between",
			}),
			carousel({
				controlGroups: [
					controlGroup({
						controls: [
							previousControl({ appearance: arrow, visibility: arrowVisibility }),
							nextControl({ appearance: arrow, visibility: arrowVisibility }),
							indicatorsControl({
								appearance: { foreground: "primary" },
								visibility: { base: "visible", compact: "removed" },
							}),
						],
						gap: "1rem",
						layout: { margin: { blockStart: "-1.5rem" } },
					}),
				],
				gap: "4sp",
				slideBasis: { base: "87.5%", compact: "75%", wide: "60%" },
			}),
		],
		gap: { base: "8sp", compact: "12sp" },
		padding: { base: { blockEnd: "16sp", blockStart: "16sp" }, compact: { blockEnd: "20sp", blockStart: "20sp" } },
	}),
});
