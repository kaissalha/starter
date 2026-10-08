import { defineSection } from "../section-definition";
import {
	box,
	contactForm,
	contentLayout,
	description,
	divider,
	flex,
	grid,
	heading,
	sectionRoot,
	space,
	spaceEdges,
	text,
} from "./_shared/blocks";

const contactRow = ({ index }: { index: number }) =>
	flex({
		children: [
			text({ appearance: "label-sm", pointer: `/contactRows/items/${index}/label`, tone: "muted" }),
			text({ appearance: "body-sm", pointer: `/contactRows/items/${index}/value` }),
		],
		direction: "column",
		gap: space(2),
		layout: { minInlineSize: 0 },
	});

const formBorders = ({
	sides,
	wide,
}: {
	sides: Array<"block-start" | "block-end" | "inline-start" | "inline-end">;
	wide: boolean;
}) =>
	box({
		border: { color: "border", sides, width: "1px" },
		children: [],
		decorative: true,
		layout: {
			blockSize: "full",
			inlineSize: "full",
			inset: { blockStart: 0, inlineStart: 0 },
			position: "absolute",
			visibility: wide ? { base: "removed", wide: "visible" } : { base: "visible", wide: "removed" },
		},
	});

export const contactEditorialBorderedSection = defineSection({
	category: "contact",
	pattern: "contact-editorial-bordered",
	repeaters: [
		{
			collection: "/contactRows",
			createValues: ({ index }) => [contactRow({ index })],
			initial: 3,
			max: 4,
			min: 0,
			target: "/props/children/1/props/children/0/props/children/1/props/children/1/props/children",
		},
	],
	root: sectionRoot({
		children: [
			divider(),
			grid({
				children: [
					flex({
						children: [
							heading({ appearance: "heading-sm" }),
							flex({
								children: [
									description({}),
									grid({ children: [], columns: { base: 1, compact: 2 }, gap: space(6) }),
								],
								direction: "column",
								gap: space({ base: 8, compact: 6 }),
								layout: { maxInlineSize: "36rem" },
							}),
						],
						direction: "column",
						gap: space({ base: 2, compact: 2, wide: 8 }),
						justify: { base: "start", wide: "between" },
						layout: {
							padding: spaceEdges({
								blockEnd: { base: 12, compact: 16 },
								blockStart: { base: 12, compact: 16 },
								inlineEnd: { base: 6, compact: 6, wide: 12 },
								inlineStart: { base: 6, compact: 6, wide: 0 },
							}),
						},
					}),
					flex({
						align: "center",
						children: [
							formBorders({ sides: ["block-start", "block-end"], wide: false }),
							formBorders({ sides: ["inline-start", "inline-end"], wide: true }),
							contactForm({ columns: 2, layout: { inlineSize: "full" }, submitWidth: "full" }),
						],
						direction: "column",
						justify: "center",
						layout: {
							padding: spaceEdges({
								blockEnd: { base: 12, compact: 16 },
								blockStart: { base: 12, compact: 16 },
								inlineEnd: { base: 6, compact: 6, wide: 12 },
								inlineStart: { base: 6, compact: 6, wide: 12 },
							}),
							position: "relative",
						},
						pattern: "diagonal-slash",
					}),
				],
				columns: { base: 1, wide: 2 },
				gap: space({ base: 6, compact: 6, wide: 0 }),
				layout: {
					...contentLayout(),
					padding: spaceEdges({ inlineEnd: { base: 0, wide: 6 }, inlineStart: { base: 0, wide: 6 } }),
				},
			}),
			divider(),
		],
	}),
});
