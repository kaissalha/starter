import { defineSection } from "../section-definition";
import { flex, sectionShell, symmetric, text } from "../team/_shared/nodes";
import { carousel, controlGroup, indicatorsControl, nextControl, previousControl } from "./_shared/durable-carousel";

const arrow = { foreground: "muted" } as const;

const createTestimonial = ({ index }: { index: number }) =>
	flex({
		align: "center",
		children: [
			text({
				align: "center",
				appearance: "heading-lg",
				layout: { maxInlineSize: "48rem" },
				pointer: `/testimonials/items/${index}/quote`,
				style: "italic",
			}),
			flex({
				align: "center",
				children: [
					text({
						align: "center",
						appearance: "body-md",
						pointer: `/testimonials/items/${index}/name`,
						style: "italic",
						tone: "muted",
					}),
					text({
						align: "center",
						appearance: "body-sm",
						pointer: `/testimonials/items/${index}/title`,
						tone: "muted",
					}),
				],
				direction: "column",
				gap: "1sp",
			}),
		],
		direction: "column",
		gap: { base: "8sp", compact: "6sp" },
		layout: { padding: { base: { blockEnd: "1sp", blockStart: "1sp", inlineEnd: "1sp", inlineStart: "1sp" } } },
	});

export const testimonialCenteredCarouselSection = defineSection({
	category: "testimonials",
	pattern: "testimonial-centered-carousel",
	repeaters: [
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createTestimonial({ index })],
			initial: 4,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/slides",
		},
	],
	root: sectionShell({
		children: [
			text({ align: "center", appearance: "title-md", element: "h2", pointer: "/copy/heading" }),
			carousel({
				controlGroups: [
					controlGroup({
						align: "center",
						controls: [
							previousControl({ appearance: arrow }),
							indicatorsControl({
								activeOpacity: 1,
								activeWidth: "0.5rem",
								appearance: { foreground: "muted" },
								inactiveOpacity: 0.4,
								size: "0.375rem",
							}),
							nextControl({ appearance: arrow }),
						],
						gap: "1rem",
						layout: { margin: { blockStart: "0.5rem" } },
					}),
					controlGroup({
						align: "center",
						controls: [
							{
								appearance: { appearance: "body-sm", style: "italic", tone: "muted" },
								kind: "counter",
								separator: "/",
							},
						],
						layout: { margin: { blockStart: "-2rem" } },
					}),
				],
				slideBasis: "100%",
			}),
		],
		gap: "16sp",
		padding: { base: symmetric({ value: "20sp" }), compact: symmetric({ value: "24sp" }) },
	}),
});
