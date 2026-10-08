import { defineSection } from "../section-definition";
import { flex, itemMedia, sectionShell, text } from "../team/_shared/nodes";
import { carousel, controlGroup, indicatorsControl } from "./_shared/durable-carousel";

const createTestimonial = ({ index }: { index: number }) =>
	flex({
		align: "center",
		children: [
			flex({
				align: "center",
				children: [
					{
						props: { name: "quote", size: { base: "6sp", compact: "7sp" }, tone: "accent-text" },
						type: "icon",
					},
				],
				direction: "row",
				fill: "featured",
				justify: "center",
				layout: {
					blockSize: { base: "12sp", compact: "14sp" },
					inlineSize: { base: "12sp", compact: "14sp" },
				},
				radius: "theme",
			}),
			flex({
				align: "center",
				children: [
					text({
						align: "center",
						appearance: "display-sm",
						pointer: `/testimonials/items/${index}/quote`,
					}),
					text({
						align: "center",
						appearance: "body-lg",
						pointer: `/testimonials/items/${index}/complement`,
						tone: "muted",
					}),
				],
				direction: "column",
				gap: "4sp",
				layout: { inlineSize: "full", maxInlineSize: "56rem" },
			}),
			flex({
				align: "center",
				children: [
					itemMedia({
						collection: "testimonials",
						index,
						layout: {
							aspectRatio: { height: 1, width: 1 },
							blockSize: { base: "12sp", compact: "16sp" },
							inlineSize: { base: "12sp", compact: "16sp" },
							shrink: 0,
						},
						radius: "full",
					}),
					flex({
						align: "center",
						children: [
							text({ appearance: "body-md", pointer: `/testimonials/items/${index}/name` }),
							text({
								appearance: "body-sm",
								pointer: `/testimonials/items/${index}/title`,
								tone: "muted",
							}),
						],
						direction: "column",
						gap: "1sp",
					}),
				],
				direction: "column",
				gap: "4sp",
				layout: { inlineSize: "full", maxInlineSize: "56rem" },
			}),
		],
		direction: "column",
		fill: "tint",
		gap: "6sp",
		justify: "between",
		layout: {
			blockSize: "full",
			inlineSize: "full",
			minBlockSize: "160sp",
			padding: {
				base: { blockEnd: "24sp", blockStart: "16sp", inlineEnd: "6sp", inlineStart: "6sp" },
				compact: { blockEnd: "28sp", blockStart: "20sp", inlineEnd: "12sp", inlineStart: "12sp" },
				wide: { blockEnd: "30sp", blockStart: "22sp", inlineEnd: "16sp", inlineStart: "16sp" },
			},
		},
		radius: "theme",
	});

export const testimonialFullscreenSliderSection = defineSection({
	category: "testimonials",
	pattern: "testimonial-fullscreen-slider",
	repeaters: [
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createTestimonial({ index })],
			initial: 3,
			max: 6,
			min: 1,
			target: "/props/children/0/props/children/0/props/slides",
		},
	],
	root: sectionShell({
		children: [
			carousel({
				autoplay: { delay: 5000 },
				controlGroups: [
					controlGroup({
						align: "center",
						controls: [
							indicatorsControl({
								activeOpacity: 1,
								activeWidth: "8sp",
								appearance: { foreground: "primary" },
								inactiveOpacity: 0.3,
								size: "2sp",
								spacing: "2sp",
							}),
						],
						layout: {
							inset: {
								base: { blockEnd: "12sp", inlineEnd: 0, inlineStart: 0 },
								compact: { blockEnd: "16sp", inlineEnd: 0, inlineStart: 0 },
								wide: { blockEnd: "18sp", inlineEnd: 0, inlineStart: 0 },
							},
							position: "absolute",
						},
					}),
				],
				gap: 0,
				layout: { position: "relative" },
				options: { align: "center", loop: true },
				slideBasis: "100%",
			}),
		],
		padding: { base: { blockEnd: "8sp", blockStart: "8sp" }, compact: { blockEnd: "10sp", blockStart: "10sp" } },
	}),
});
