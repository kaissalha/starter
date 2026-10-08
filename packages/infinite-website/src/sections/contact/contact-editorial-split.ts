import { defineSection } from "../section-definition";
import {
	contactForm,
	contentLayout,
	description,
	divider,
	flex,
	grid,
	heading,
	kicker,
	sectionRoot,
	space,
	spaceEdges,
	text,
} from "./_shared/blocks";

const contactRow = ({ index }: { index: number }) =>
	flex({
		children: [
			divider(),
			flex({
				children: [
					text({ appearance: "label-sm", pointer: `/contactRows/items/${index}/label`, tone: "muted" }),
					text({ appearance: "title-md", pointer: `/contactRows/items/${index}/value` }),
				],
				direction: "column",
				gap: space(2),
				layout: { padding: spaceEdges({ blockEnd: { base: 6, wide: 4 }, blockStart: { base: 6, wide: 4 } }) },
			}),
		],
		direction: "column",
	});

export const contactEditorialSplitSection = defineSection({
	category: "contact",
	pattern: "contact-editorial-split",
	repeaters: [
		{
			collection: "/contactRows",
			createValues: ({ index }) => [contactRow({ index })],
			initial: 3,
			max: 4,
			min: 0,
			target: "/props/children/0/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionRoot({
		children: [
			grid({
				children: [
					flex({
						children: [
							flex({
								children: [
									kicker(),
									flex({
										children: [heading({}), description({})],
										direction: "column",
										gap: space(6),
									}),
								],
								direction: "column",
								gap: space(2),
							}),
							flex({ children: [], direction: "column" }),
						],
						direction: "column",
						gap: space(12),
						layout: {
							padding: spaceEdges({
								blockEnd: { base: 16, compact: 20 },
								blockStart: { base: 16, compact: 20 },
							}),
						},
					}),
					flex({
						align: "center",
						children: [
							contactForm({
								columns: 2,
								fill: "subtle",
								layout: {
									inlineSize: "full",
									padding: spaceEdges({
										blockEnd: { base: 6, wide: 8 },
										blockStart: { base: 6, wide: 8 },
										inlineEnd: { base: 6, wide: 8 },
										inlineStart: { base: 6, wide: 8 },
									}),
								},
								radius: "theme",
								submitWidth: "full",
							}),
						],
						direction: "column",
						justify: "center",
						layout: {
							padding: spaceEdges({
								blockEnd: { base: 16, compact: 20 },
								blockStart: { base: 8, compact: 20 },
							}),
						},
					}),
				],
				columns: { base: 1, wide: 2 },
				gap: space({ base: 0, wide: 12 }),
				layout: contentLayout({ block: 0 }),
			}),
		],
	}),
});
