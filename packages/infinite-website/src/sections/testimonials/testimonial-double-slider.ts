import { defineSection } from "../section-definition";
import { box, button, flex, kicker, sectionContent, text } from "../team/_shared/nodes";
import { createAuthorRow } from "./_shared/author-row";
import { carousel, controlGroup, indicatorsControl } from "./_shared/durable-carousel";

const createCard = ({ index }: { index: number }) =>
	flex({
		children: [
			{ props: { name: "quote", size: "1.5rem", tone: "accent-text" }, type: "icon" },
			flex({
				children: [
					text({ appearance: "body-md", pointer: `/testimonials/items/${index}/quote`, tone: "muted" }),
					createAuthorRow({ avatarSize: "12sp", gap: "4sp", index }),
				],
				direction: "column",
				gap: "6sp",
				justify: "between",
				layout: { grow: 1 },
			}),
		],
		direction: "column",
		fill: "tint",
		gap: "6sp",
		layout: {
			inlineSize: "full",
			minBlockSize: "80sp",
			padding: { base: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" } },
		},
		radius: "theme",
	});

const column = ({ reverse = false }: { reverse?: boolean }) =>
	carousel({
		controlGroups: [],
		gap: "4sp",
		layout: { grow: 1, minInlineSize: 0 },
		marquee: { direction: reverse ? "backward" : "forward", speed: reverse ? 0.4 : 0.5 },
		options: { align: "start", axis: "y", draggable: false, loop: true, startIndex: reverse ? 3 : 0 },
		slideBasis: "auto",
		viewportLayout: { blockSize: "100vh", inlineSize: "full", margin: { inlineEnd: 0, inlineStart: 0 } },
	});

const createIntro = () =>
	flex({
		children: [
			flex({
				children: [
					kicker({ pointer: "/copy/kicker" }),
					text({ appearance: "display-sm", element: "h2", pointer: "/copy/heading" }),
				],
				direction: "column",
				gap: "4sp",
			}),
			text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
			flex({
				children: [button({ index: 0 })],
				direction: { base: "column", compact: "row" },
				gap: "4sp",
			}),
		],
		direction: "column",
		gap: "8sp",
	});

export const testimonialDoubleSliderSection = defineSection({
	category: "testimonials",
	pattern: "testimonial-double-slider",
	repeaters: [
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createCard({ index })],
			initial: 6,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/children/0/props/slides",
		},
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createCard({ index })],
			initial: 6,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/children/1/props/slides",
		},
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createCard({ index })],
			initial: 6,
			max: 8,
			min: 2,
			target: "/props/children/1/props/children/1/props/slides",
		},
	],
	root: box({
		children: [
			sectionContent({
				children: [
					flex({
						children: [createIntro()],
						direction: "column",
						justify: "center",
						layout: {
							inlineSize: "45%",
							maxInlineSize: "50%",
							padding: {
								base: { blockEnd: "16sp", blockStart: "16sp" },
								compact: { blockEnd: "20sp", blockStart: "20sp" },
							},
							shrink: 0,
						},
					}),
					flex({
						children: [column({}), column({ reverse: true })],
						direction: "row",
						gap: "4sp",
						layout: {
							inlineSize: "50cqw",
							margin: { inlineEnd: "viewport-bleed-offset" },
							overflow: "hidden",
							shrink: 0,
						},
					}),
				],
				direction: "row",
				gap: "12sp",
				justify: "between",
				layout: { visibility: { base: "removed", wide: "visible" } },
				padding: { base: { blockEnd: 0, blockStart: 0 } },
			}),
			sectionContent({
				children: [
					createIntro(),
					carousel({
						autoplay: { delay: 3000 },
						controlGroups: [
							controlGroup({ align: "center", controls: [indicatorsControl({ spacing: "0.5rem" })] }),
						],
						controlsGap: "6sp",
						gap: "4sp",
						options: { loop: true },
						slideBasis: "87.5%",
					}),
				],
				gap: "8sp",
				layout: { visibility: { base: "visible", wide: "removed" } },
				padding: {
					base: { blockEnd: "12sp", blockStart: "12sp" },
					compact: { blockEnd: "16sp", blockStart: "16sp" },
				},
			}),
		],
		fill: "canvas",
	}),
});
