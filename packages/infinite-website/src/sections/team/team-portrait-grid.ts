import { defineSection } from "../section-definition";
import { button, flex, grid, itemMedia, sectionShell, symmetric, text } from "./_shared/nodes";

const createMember = ({ index }: { index: number }) =>
	flex({
		children: [
			itemMedia({
				collection: "members",
				hoverOpacity: 1,
				imageOpacity: 0.8,
				index,
				layout: { blockSize: { base: "75sp", compact: "100sp", wide: "80sp" }, inlineSize: "full" },
			}),
			flex({
				align: "center",
				children: [
					text({ appearance: "body-md", element: "h3", pointer: `/members/items/${index}/name` }),
					text({
						appearance: "label-sm",
						element: "span",
						layout: { shrink: 0 },
						pointer: `/members/items/${index}/role`,
						tone: "muted",
					}),
				],
				direction: "row",
				gap: "4sp",
				justify: "between",
				layout: { padding: { base: { blockStart: "6sp" }, wide: { blockStart: "4sp" } } },
			}),
			text({
				appearance: "body-sm",
				layout: { padding: { base: { blockStart: "4sp" }, wide: { blockStart: "3sp" } } },
				pointer: `/members/items/${index}/description`,
				tone: "muted",
			}),
		],
		direction: "column",
		layout: { inlineSize: "full" },
	});

export const teamPortraitGridSection = defineSection({
	category: "team",
	pattern: "team-portrait-grid",
	repeaters: [
		{
			collection: "/members",
			createValues: ({ index }) => [createMember({ index })],
			initial: 4,
			max: 9,
			min: 1,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionShell({
		children: [
			flex({
				align: { base: "stretch", compact: "center" },
				children: [
					flex({
						children: [
							text({ appearance: "heading-sm", element: "h2", pointer: "/copy/heading" }),
							text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
						],
						direction: "column",
						gap: "2sp",
						layout: { maxInlineSize: "36rem" },
					}),
					button({ index: 0, layout: { shrink: 0 }, variant: "outline" }),
				],
				direction: { base: "column", compact: "row" },
				gap: "6sp",
				justify: "between",
			}),
			grid({ children: [], columns: { base: 1, compact: 2, wide: 3 }, gap: "4sp" }),
		],
		gap: "12sp",
		padding: { base: symmetric({ value: "12sp" }), compact: symmetric({ value: "16sp" }) },
	}),
});
