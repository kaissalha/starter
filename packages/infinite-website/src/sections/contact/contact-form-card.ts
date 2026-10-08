import { defineSection } from "../section-definition";
import {
	backgroundMedia,
	box,
	contactForm,
	contentLayout,
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

const contactGroup = ({ index }: { index: number }) =>
	flex({
		children: [
			text({ appearance: "title-md", pointer: `/contactGroups/items/${index}/title`, tone: "muted" }),
			text({ appearance: "body-md", pointer: `/contactGroups/items/${index}/value`, tone: "muted" }),
		],
		direction: "column",
		gap: space(2),
	});

const padding = ({ base, wide }: { base: number; wide: number }) =>
	spaceEdges({
		blockEnd: { base, wide },
		blockStart: { base, wide },
		inlineEnd: { base, wide },
		inlineStart: { base, wide },
	});

export const contactFormCardSection = defineSection({
	category: "contact",
	pattern: "contact-form-card",
	repeaters: [
		{
			collection: "/contactGroups",
			createValues: ({ index }) => [contactGroup({ index })],
			initial: 2,
			max: 4,
			min: 0,
			target: "/props/children/1/props/children/0/props/children/2/props/children/0/props/children/1/props/children",
		},
	],
	root: sectionRoot({
		children: [
			backgroundMedia(),
			flex({
				children: [
					flex({
						border: { color: "border", width: "1px" },
						children: [
							flex({
								children: [kicker()],
								direction: "column",
								layout: {
									padding: spaceEdges({ blockEnd: 3, blockStart: 3, inlineEnd: 4, inlineStart: 4 }),
								},
							}),
							divider(),
							grid({
								children: [
									flex({
										children: [
											heading({}),
											grid({
												children: [],
												columns: { base: 1, wide: 2 },
												gap: space({ base: 6, wide: 8 }),
											}),
										],
										direction: "column",
										gap: space({ base: 8, compact: 8, wide: 0 }),
										justify: "between",
										layout: { padding: padding({ base: 5, wide: 8 }) },
									}),
									box({
										children: [],
										decorative: true,
										fill: "border",
										layout: {
											blockSize: "full",
											inlineSize: "1px",
											inset: { blockStart: 0, inlineStart: "50%" },
											position: "absolute",
											visibility: { base: "removed", wide: "visible" },
										},
									}),
									flex({
										children: [
											divider({ layout: { visibility: { base: "visible", wide: "removed" } } }),
											box({
												children: [contactForm({ submitWidth: "full" })],
												layout: { padding: padding({ base: 5, wide: 8 }) },
											}),
										],
										direction: "column",
									}),
								],
								columns: { base: 1, wide: 2 },
								layout: { position: "relative" },
							}),
						],
						direction: "column",
						fill: "canvas",
						radius: "theme",
					}),
				],
				direction: "column",
				layout: { ...contentLayout(), position: "relative" },
			}),
		],
		layout: { position: "relative" },
	}),
});
