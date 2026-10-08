import { defineSection } from "../section-definition";
import { box, divider, flex, grid, sectionShell, text } from "../team/_shared/nodes";

const createTestimonial = ({ index }: { index: number }) =>
	flex({
		border: { color: "border", sides: ["inline-end", "block-end"], width: 1 },
		children: [
			text({
				appearance: "body-md",
				layout: { padding: { blockEnd: "8sp" } },
				pointer: `/testimonials/items/${index}/quote`,
				tone: "muted",
			}),
			flex({
				children: [
					text({ appearance: "label-md", pointer: `/testimonials/items/${index}/name` }),
					text({ appearance: "label-sm", pointer: `/testimonials/items/${index}/title`, tone: "muted" }),
				],
				direction: "column",
				layout: { margin: { blockStart: "auto" } },
			}),
		],
		direction: "column",
		gap: "12sp",
		layout: {
			padding: {
				base: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" },
				compact: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "8sp", inlineStart: "8sp" },
			},
		},
	});

export const testimonialBorderedGridSection = defineSection({
	category: "testimonials",
	pattern: "testimonial-bordered-grid",
	repeaters: [
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createTestimonial({ index })],
			initial: 3,
			max: 6,
			min: 1,
			target: "/props/children/0/props/children/1/props/children/0/props/children/0/props/children",
		},
	],
	root: sectionShell({
		after: [divider()],
		children: [
			flex({
				children: [
					text({ appearance: "heading-sm", element: "h2", pointer: "/copy/heading" }),
					text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
				],
				direction: "column",
				gap: "2sp",
			}),
			flex({
				children: [
					box({
						border: { color: "border", sides: ["block-start", "inline-start", "inline-end"], width: 1 },
						children: [
							grid({
								children: [],
								columns: { base: 1, compact: 2, wide: 3 },
								layout: { margin: { inlineEnd: -1 } },
							}),
						],
						layout: { overflow: "hidden" },
						radius: "theme",
					}),
					box({
						border: { color: "border", sides: ["inline-start", "inline-end"], width: 1 },
						children: [],
						fill: "tint",
						layout: { blockSize: "16sp", inlineSize: "full" },
						pattern: "diagonal-slash",
					}),
				],
				direction: "column",
			}),
		],
		gap: "8sp",
		padding: { base: { blockStart: "12sp" }, compact: { blockStart: "16sp" } },
	}),
});
