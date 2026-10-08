import { defineSection } from "../section-definition";
import { divider, flex, itemMedia, sectionShell, symmetric, text } from "./_shared/nodes";
import { createSplitHeader } from "./_shared/split-header";

const createMember = ({ index }: { index: number }) =>
	flex({
		children: [
			itemMedia({
				collection: "members",
				index,
				layout: { blockSize: { base: "75sp", compact: "100sp", wide: "70sp" }, inlineSize: "full" },
			}),
			flex({
				children: [
					flex({
						children: [
							text({ appearance: "body-sm", pointer: `/members/items/${index}/role`, tone: "muted" }),
							divider(),
						],
						direction: "column",
						gap: "3sp",
					}),
					flex({
						children: [
							text({ appearance: "heading-sm", element: "h3", pointer: `/members/items/${index}/name` }),
							text({
								appearance: "body-md",
								pointer: `/members/items/${index}/description`,
								tone: "muted",
							}),
						],
						direction: "column",
						gap: "2sp",
					}),
				],
				direction: "column",
				gap: "6sp",
			}),
		],
		direction: "column",
		gap: "4sp",
		layout: { grow: 1, inlineSize: 0, minInlineSize: "20rem" },
	});

export const teamGridSection = defineSection({
	category: "team",
	pattern: "team-grid",
	repeaters: [
		{
			collection: "/members",
			createValues: ({ index }) => [createMember({ index })],
			initial: 4,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionShell({
		children: [
			createSplitHeader({
				buttonVariants: ["primary"],
				columnGap: "8sp",
				rowGap: { base: "4sp", compact: "8sp" },
			}),
			flex({ children: [], direction: "row", gap: "4sp", wrap: "wrap" }),
		],
		gap: { base: "8sp", compact: "16sp" },
		padding: { base: symmetric({ value: "12sp" }), compact: symmetric({ value: "16sp" }) },
	}),
});
