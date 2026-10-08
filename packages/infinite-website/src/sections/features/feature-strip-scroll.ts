import { defineSection } from "../section-definition";
import { blockEdges, flex, image, sectionBox, text } from "./_shared/section-parts";

const stripImage = ({ image: key, index }: { image: number; index: number }) =>
	image({
		aspectRatio: { height: 4, width: 3 },
		blockSize: "80sp",
		layout: { grow: 1 },
		pointer: `/items/items/${index}/images/items/${key}`,
	});

const card = ({ index }: { index: number }) =>
	flex({
		children: [
			text({
				appearance: "display-sm",
				element: "h2",
				layout: { maxInlineSize: "36rem" },
				pointer: `/items/items/${index}/title`,
			}),
			flex({
				children: [],
				direction: "row",
				gap: "4sp",
			}),
			text({
				appearance: "body-md",
				layout: { maxInlineSize: "32rem" },
				pointer: `/items/items/${index}/description`,
				tone: "muted",
			}),
		],
		gap: "6sp",
	});

export const featureStripScrollSection = defineSection({
	category: "features",
	pattern: "feature-strip-scroll",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [card({ index })],
			initial: 3,
			max: 6,
			min: 1,
			target: "/props/children/0/props/slides",
		},
		{
			collection: "/items/*/images",
			createValues: ({ index, parentIndex }) => [stripImage({ image: index, index: parentIndex })],
			initial: 3,
			max: 6,
			min: 1,
			target: "/0/props/children/1/props/children",
		},
	],
	root: sectionBox({
		children: [
			{
				layout: { padding: { base: blockEdges("16sp"), compact: blockEdges("20sp") } },
				props: {
					controlGroups: [],
					gap: "6sp",
					inactiveOpacity: 1,
					label: { $text: "/accessibility/carouselLabel" },
					options: { align: "start", containScroll: "trim-snaps", loop: false },
					slideBasis: "max-content",
					slides: [],
					trackLayout: {
						padding: {
							base: { inlineEnd: "6sp", inlineStart: "6sp" },
							compact: { inlineEnd: "12sp", inlineStart: "12sp" },
						},
					},
					viewportLayout: { inlineSize: "full", margin: { inlineEnd: 0, inlineStart: 0 } },
				},
				type: "carousel",
			},
		],
	}),
});
