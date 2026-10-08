import {
	contentLayout,
	description,
	flex,
	grid,
	heading,
	kicker,
	sectionRoot,
	space,
	spaceEdges,
	text,
} from "../contact/_shared/blocks";
import { defineSection } from "../section-definition";

const hoursRow = ({ index }: { index: number }) =>
	grid({
		align: "center",
		children: [
			text({ appearance: "heading-sm", pointer: `/hours/items/${index}/day` }),
			text({ appearance: "body-md", pointer: `/hours/items/${index}/schedule`, tone: "muted" }),
		],
		columns: { base: 1, compact: 2 },
		gap: space({ base: 2, compact: 6, wide: 10 }),
		layout: {
			inlineSize: { base: "full", compact: "fit-content" },
			padding: spaceEdges({
				blockEnd: { base: 4, compact: 6 },
				blockStart: { base: 4, compact: 6 },
				inlineEnd: { base: 4, compact: 6 },
				inlineStart: { base: 4, compact: 6 },
			}),
		},
	});

export const locationBusinessHoursSection = defineSection({
	category: "location",
	pattern: "location-business-hours",
	repeaters: [
		{
			collection: "/hours",
			createValues: ({ index }) => [hoursRow({ index })],
			initial: 7,
			max: 7,
			min: 1,
			target: "/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionRoot({
		children: [
			flex({
				children: [
					grid({
						align: "start",
						children: [
							flex({
								children: [kicker(), heading({})],
								direction: "column",
								gap: space(4),
								layout: { gridColumn: { base: { span: 1, start: 1 }, wide: { span: 5, start: 1 } } },
							}),
							flex({
								children: [description({ appearance: "body-lg" })],
								direction: "column",
								layout: {
									gridColumn: { base: { span: 1, start: 1 }, wide: { span: 6, start: 7 } },
									padding: spaceEdges({ blockStart: { base: 0, wide: 11 } }),
								},
							}),
						],
						columns: { base: 1, wide: 12 },
						gap: space({ base: 4, compact: 8 }),
					}),
					flex({ children: [], direction: "column" }),
				],
				direction: "column",
				gap: space(12),
				layout: contentLayout(),
			}),
		],
	}),
});
