import { defineSection } from "../section-definition";
import { box, flex, media, sectionShell, symmetric, text } from "../team/_shared/nodes";
import { carousel, controlGroup, nextControl, previousControl } from "./_shared/durable-carousel";

const arrow = { foreground: "primary", radius: "none" } as const;

const arrowStyle = { corners: "square", icon: "arrow", iconSize: "4sp", size: "10sp" } as const;

const createTestimonial = ({ index }: { index: number }) =>
	flex({
		children: [
			text({ appearance: "display-sm", pointer: `/testimonials/items/${index}/quote` }),
			flex({
				children: [
					text({ appearance: "title-sm", pointer: `/testimonials/items/${index}/name` }),
					text({ appearance: "body-sm", pointer: `/testimonials/items/${index}/title`, tone: "muted" }),
				],
				direction: "column",
				layout: { inlineSize: "50%", margin: { blockStart: "auto" } },
			}),
		],
		direction: "column",
		gap: "8sp",
		layout: {
			padding: {
				base: { blockEnd: "6sp", blockStart: "6sp", inlineEnd: "6sp", inlineStart: "6sp" },
				wide: { blockEnd: "4sp", blockStart: "4sp", inlineEnd: "4sp", inlineStart: "4sp" },
			},
		},
	});

export const testimonialParallaxQuoteSection = defineSection({
	category: "testimonials",
	pattern: "testimonial-parallax-quote",
	repeaters: [
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createTestimonial({ index })],
			initial: 5,
			max: 8,
			min: 2,
			target: "/props/children/1/props/children/0/props/children/0/props/slides",
		},
	],
	root: sectionShell({
		background: [
			media({
				alt: { $text: "/media/items/0/alt" },
				assetId: { $asset: "/media/items/0/assetId" },
				fit: "cover",
				layout: {
					blockSize: "full",
					inlineSize: "full",
					inset: { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 },
					position: "absolute",
				},
			}),
		],
		children: [
			box({
				border: { color: "border", width: 1 },
				children: [
					carousel({
						controlGroups: [
							controlGroup({
								align: "end",
								controls: [
									{
										appearance: { appearance: "body-sm", tone: "muted" },
										kind: "counter",
										separator: "/",
									},
								],
								placement: "header",
							}),
							controlGroup({
								align: "end",
								appearance: {
									border: { color: "border", width: 1 },
									fill: "canvas",
									radius: {
										endEnd: "theme",
										endStart: "none",
										startEnd: "none",
										startStart: "theme",
									},
								},
								controls: [
									previousControl({
										appearance: {
											...arrow,
											border: { color: "border", sides: ["inline-end"], width: 1 },
										},
										...arrowStyle,
									}),
									nextControl({ appearance: arrow, ...arrowStyle }),
								],
								layout: { inset: { blockEnd: -1, inlineEnd: -1 }, position: "absolute" },
							}),
						],
						controlsGap: 0,
						header: {
							align: "center",
							border: { color: "border", sides: ["block-end"], width: 1 },
							children: [
								text({
									appearance: "title-xs",
									element: "h2",
									pointer: "/copy/heading",
									tone: "muted",
								}),
							],
							direction: "row",
							justify: "between",
							layout: {
								padding: {
									base: { blockEnd: "4sp", blockStart: "4sp", inlineEnd: "6sp", inlineStart: "6sp" },
									wide: { blockEnd: "3sp", blockStart: "3sp", inlineEnd: "4sp", inlineStart: "4sp" },
								},
							},
						},
						layout: { position: "relative" },
						options: { loop: true, transition: "fade" },
						slideBasis: "100%",
						slideSizing: "exact",
						viewportLayout: { inlineSize: "full", margin: { inlineEnd: 0, inlineStart: 0 } },
					}),
				],
				fill: "canvas",
				radius: "theme",
			}),
		],
		padding: { base: symmetric({ value: "16sp" }), compact: symmetric({ value: "20sp" }) },
		rootLayout: { position: "relative" },
	}),
});
