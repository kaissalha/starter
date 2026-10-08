import { defineSection } from "../section-definition";
import { divider, flex, grid, itemMedia, sectionShell, symmetric, text } from "./_shared/nodes";
import { createSplitHeader } from "./_shared/split-header";

const createMember = ({ index }: { index: number }) =>
	flex({
		children: [
			itemMedia({
				collection: "members",
				index,
				layout: { aspectRatio: { height: 1, width: 1 }, inlineSize: "full", shrink: 0 },
			}),
			flex({
				children: [
					flex({
						children: [
							text({ appearance: "title-sm", element: "h3", pointer: `/members/items/${index}/name` }),
							text({ appearance: "body-sm", pointer: `/members/items/${index}/role`, tone: "muted" }),
						],
						direction: "column",
					}),
					divider(),
					text({ appearance: "body-sm", pointer: `/members/items/${index}/description`, tone: "muted" }),
				],
				direction: "column",
				gap: "2sp",
			}),
		],
		direction: "column",
		gap: "4sp",
	});

export const teamEditorialGridSection = defineSection({
	category: "team",
	pattern: "team-editorial-grid",
	repeaters: [
		{
			collection: "/members",
			createValues: ({ index }) => [createMember({ index })],
			initial: 3,
			max: 6,
			min: 1,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionShell({
		children: [
			createSplitHeader({
				buttonVariants: ["primary"],
				columnGap: "6sp",
				rowAlign: "start",
				rowGap: "6sp",
			}),
			grid({
				align: "start",
				children: [],
				columns: { base: 1, compact: 2, wide: 3 },
				gap: "3sp",
			}),
		],
		gap: { base: "8sp", compact: "12sp" },
		padding: { base: symmetric({ value: "12sp" }), compact: symmetric({ value: "16sp" }) },
	}),
});
