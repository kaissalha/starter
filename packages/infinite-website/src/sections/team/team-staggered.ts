import { defineSection } from "../section-definition";
import { flex, grid, itemMedia, sectionShell, symmetric, text } from "./_shared/nodes";

const createMember = ({ index }: { index: number }) =>
	flex({
		children: [
			itemMedia({
				collection: "members",
				index,
				layout: { aspectRatio: { height: 3, width: 4 }, inlineSize: "full" },
			}),
			flex({
				children: [
					text({
						appearance: "heading-sm",
						element: "h3",
						pointer: `/members/items/${index}/name`,
						style: "italic",
					}),
					text({ appearance: "body-sm", pointer: `/members/items/${index}/role`, tone: "muted" }),
				],
				direction: "column",
			}),
		],
		direction: "column",
		gap: { base: "4sp", wide: "3sp" },
		layout: {
			gridColumn: { base: { span: 1, start: 1 }, compact: { span: 1, start: (index % 2) + 1 } },
			gridRow: {
				base: { span: 1, start: index + 1 },
				compact: { span: 3, start: Math.floor(index / 2) * 4 + 1 + (index % 2) * 2 },
			},
		},
	});

export const teamStaggeredSection = defineSection({
	category: "team",
	pattern: "team-staggered",
	repeaters: [
		{
			collection: "/members",
			createValues: ({ index }) => [createMember({ index })],
			initial: 3,
			max: 6,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionShell({
		children: [
			grid({
				children: [
					text({ appearance: "heading-sm", element: "h2", pointer: "/copy/heading" }),
					text({ appearance: "body-sm", pointer: "/copy/description", tone: "muted" }),
				],
				columns: { base: 1, wide: 2 },
				gap: { base: "6sp", wide: "16sp" },
			}),
			grid({
				children: [],
				columnGap: "8sp",
				columns: { base: 1, compact: 2 },
				rowGap: { base: "8sp", compact: 0 },
			}),
		],
		gap: "16sp",
		padding: { base: symmetric({ value: "20sp" }), compact: symmetric({ value: "24sp" }) },
	}),
});
