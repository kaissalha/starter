import type { BoxAppearance } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { box, flex, kicker, media, sectionShell, symmetric, text } from "../team/_shared/nodes";
import { carousel, controlGroup, nextControl, previousControl } from "./_shared/durable-carousel";

const createTestimonial = ({ index }: { index: number }) =>
	flex({
		border: { color: "border", sides: ["inline-end"], width: 1 },
		children: [
			text({ appearance: "body-lg", pointer: `/testimonials/items/${index}/quote`, tone: "muted" }),
			flex({
				children: [
					text({ appearance: "body-md", pointer: `/testimonials/items/${index}/name` }),
					text({ appearance: "body-md", pointer: `/testimonials/items/${index}/title`, tone: "muted" }),
				],
				direction: "column",
				gap: "1sp",
			}),
		],
		direction: "column",
		gap: { base: "10sp", wide: "7sp" },
		justify: "between",
		layout: { padding: { base: { blockEnd: "8sp", blockStart: "8sp", inlineEnd: "8sp", inlineStart: "8sp" } } },
	});

const arrow = {
	border: { color: "border", sides: ["inline-end"], width: 1 },
	foreground: "primary",
	radius: "none",
} satisfies BoxAppearance;

const lastArrow = { foreground: "primary", radius: "none" } satisfies BoxAppearance;

const arrowStyle = { corners: "square", icon: "arrow", iconSize: "4sp", size: "10sp", stretch: true } as const;

export const testimonialBackgroundCardsSection = defineSection({
	category: "testimonials",
	pattern: "testimonial-background-cards",
	repeaters: [
		{
			collection: "/testimonials",
			createValues: ({ index }) => [createTestimonial({ index })],
			initial: 3,
			max: 6,
			min: 1,
			target: "/props/children/1/props/children/1/props/children/0/props/slides",
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
				overlay: { kind: "scrim", strength: "medium" },
			}),
		],
		children: [
			flex({
				children: [
					kicker({ pointer: "/copy/kicker", tone: "accent" }),
					flex({
						children: [
							text({
								appearance: "display-sm",
								element: "h2",
								layout: { inlineSize: { base: "full", wide: "50%" } },
								pointer: "/copy/heading",
								tone: "media",
							}),
							text({
								appearance: "body-md",
								layout: { inlineSize: { base: "full", wide: "50%" }, maxInlineSize: "36rem" },
								pointer: "/copy/description",
								tone: "media",
							}),
						],
						direction: { base: "column", wide: "row" },
						gap: "8sp",
					}),
				],
				direction: "column",
				gap: "6sp",
			}),
			box({
				children: [
					carousel({
						autoplay: { delay: 5000 },
						controlGroups: [
							controlGroup({
								appearance: { border: { color: "border", sides: ["block-start"], width: 1 } },
								controls: [
									previousControl({ appearance: arrow, ...arrowStyle }),
									nextControl({ appearance: lastArrow, ...arrowStyle }),
								],
								layout: { inlineSize: "full" },
							}),
						],
						controlsGap: 0,
						options: { loop: true, slidesToScroll: "auto", transition: "fade" },
						slideBasis: { base: "100%", wide: "50%" },
						slideSizing: "exact",
					}),
				],
				fill: "canvas",
				layout: { overflow: "hidden" },
				radius: "theme",
			}),
		],
		gap: "8sp",
		padding: { base: symmetric({ value: "20sp" }), compact: symmetric({ value: "24sp" }) },
		rootLayout: { position: "relative" },
	}),
});
