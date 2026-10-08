import type { AuthoringJsonValue } from "../../document/content-schema";
import { defineSection } from "../section-definition";
import { carouselOverflowViewport, clippedSectionLayout } from "./_shared/durable-carousel";
import { kicker, pad, sectionContent, sectionRoot, text } from "./_shared/durable-parts";

const slide = ({ index }: { index: number }) => ({
	layout: { blockSize: { base: "336px", wide: "440px" }, padding: pad({ block: "6sp", inline: "6sp" }) },
	props: {
		children: [
			text({ appearance: "heading-sm", element: "h3", pointer: `/features/items/${index}/title` }),
			text({ appearance: "body-sm", pointer: `/features/items/${index}/description`, tone: "muted" }),
		],
		direction: "column",
		fill: "tint",
		justify: "between",
		radius: "theme",
	},
	type: "flex",
});

export const featureCardCarouselSection = defineSection({
	category: "features",
	pattern: "feature-card-carousel",
	repeaters: [
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [slide({ index })],
			initial: 6,
			max: 10,
			min: 2,
			target: "/props/children/0/props/children/1/props/slides",
		},
	],
	root: sectionRoot({
		children: [
			sectionContent({
				children: [
					{
						layout: { maxInlineSize: "680px" },
						props: {
							children: [
								kicker({}),
								{
									props: {
										children: [
											text({ appearance: "display-md", element: "h2", pointer: "/copy/heading" }),
											text({
												appearance: "body-md",
												pointer: "/copy/description",
												tone: "muted",
											}),
										],
										direction: "column",
										gap: "8sp",
									},
									type: "flex",
								},
							],
							direction: "column",
							gap: "6sp",
						},
						type: "flex",
					},
					{
						props: {
							autoplay: { delay: 5000 },
							controlGroups: [
								{
									align: "start",
									controls: [
										{
											active: { blockSize: "2sp", inlineSize: "8sp", opacity: 1 },
											appearance: { foreground: "accent" },
											inactive: { blockSize: "2sp", inlineSize: "2sp", opacity: 0.3 },
											kind: "indicators",
											label: { $text: "/accessibility/indicatorsLabel" },
											spacing: "2sp",
										},
									],
									placement: "after",
								},
							],
							controlsGap: "8sp",
							gap: "4sp",
							label: { $text: "/accessibility/carouselLabel" },
							options: { align: "start", containScroll: "trim-snaps", loop: true },
							slideBasis: { base: "85%", compact: "320px", wide: "440px" },
							slides: [],
							viewportLayout: carouselOverflowViewport,
						},
						type: "carousel",
					},
				],
				gap: "12sp",
				padding: {
					base: pad({ block: "20sp", inline: "1.5rem" }),
					compact: pad({ block: "24sp", inline: "1.5rem" }),
				},
			}),
		],
		layout: clippedSectionLayout,
	}),
});
