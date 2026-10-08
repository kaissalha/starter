import { defineSection } from "../section-definition";
import { button, flex, grid, kicker, sectionShell, symmetric, text } from "../team/_shared/nodes";
import { createAuthorRow } from "./_shared/author-row";

const createTestimonial = ({ index }: { index: number }) =>
	flex({
		children: [
			flex({
				children: [
					{ props: { name: "quote", size: "1.5rem", tone: "accent-text" }, type: "icon" },
					text({ appearance: "body-md", pointer: `/testimonials/items/${index}/quote`, tone: "muted" }),
				],
				direction: "column",
				gap: "2sp",
			}),
			flex({
				children: [createAuthorRow({ avatarSize: "10sp", gap: "3sp", index })],
				direction: "row",
				gap: "4sp",
				justify: "between",
				layout: { margin: { blockStart: "auto" } },
			}),
		],
		direction: "column",
		fill: "tint",
		gap: "6sp",
		layout: {
			padding: { base: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" } },
		},
		radius: "theme",
	});

export const testimonialGridSection = defineSection({
	category: "testimonials",
	pattern: "testimonial-grid",
	repeaters: [
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createTestimonial({ index })],
			initial: 4,
			max: 8,
			min: 1,
			target: "/props/children/0/props/children/1/props/children",
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
						layout: { inlineSize: { base: "full", wide: "50%" }, maxInlineSize: "36rem" },
					}),
					flex({
						children: [button({ index: 0, variant: "outline" })],
						direction: "column",
						gap: "8sp",
						layout: { inlineSize: { base: "full", wide: "50%" } },
					}),
				],
				direction: { base: "column", wide: "row" },
				gap: { base: "4sp", compact: "8sp" },
				justify: "between",
			}),
			grid({ children: [], columns: { base: 1, wide: 2 }, gap: "4sp" }),
		],
		gap: { base: "8sp", compact: "12sp" },
		padding: { base: symmetric({ value: "12sp" }), compact: symmetric({ value: "16sp" }) },
	}),
});
