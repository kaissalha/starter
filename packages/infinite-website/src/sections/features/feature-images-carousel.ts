import type { AuthoringJsonValue } from "../../document/content-schema";
import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { carouselOverflowViewport, clippedSectionLayout } from "./_shared/durable-carousel";
import { kicker, media, pad, sectionContent, sectionRoot, text } from "./_shared/durable-parts";

type Control = Extract<SiteNodeDefinition, { type: "carousel" }>["props"]["controlGroups"][number]["controls"][number];

const arrow = ({ kind }: { kind: "next" | "previous" }): Control => ({
	appearance: { fill: "tint", foreground: "muted", radius: "theme" },
	corners: "square",
	iconSize: "4sp",
	kind,
	label: { $text: "/accessibility/carouselLabel" },
	size: "6sp",
	visibility: { base: "removed", wide: "visible" },
});

const slide = ({ index }: { index: number }): AuthoringJsonValue => {
	const pointer = `/features/items/${index}`;

	return {
		props: {
			children: [
				media({ layout: { aspectRatio: { height: 380, width: 507 }, inlineSize: "full" }, pointer }),
				{
					props: {
						children: [
							text({ appearance: "title-sm", element: "span", pointer: `${pointer}/title` }),
							text({
								appearance: "body-md",
								element: "span",
								pointer: `${pointer}/description`,
								tone: "muted",
							}),
						],
						direction: "column",
					},
					type: "flex",
				},
			],
			direction: "column",
			gap: "2sp",
		},
		type: "flex",
	};
};

export const featureImagesCarouselSection = defineSection({
	category: "features",
	pattern: "feature-images-carousel",
	repeaters: [
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [slide({ index })],
			initial: 4,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/1/props/slides",
		},
	],
	root: sectionRoot({
		children: [
			sectionContent({
				children: [
					{
						props: {
							children: [
								{
									props: {
										children: [
											kicker({}),
											text({
												appearance: "display-md",
												element: "h2",
												layout: { maxInlineSize: "36rem" },
												pointer: "/copy/heading",
											}),
										],
										direction: "column",
										gap: "4sp",
									},
									type: "flex",
								},
								text({
									appearance: "body-md",
									layout: { maxInlineSize: "42rem" },
									pointer: "/copy/description",
									tone: "muted",
								}),
							],
							direction: "column",
							gap: "6sp",
						},
						type: "flex",
					},
					{
						props: {
							controlGroups: [
								{
									align: "start",
									controls: [
										arrow({ kind: "previous" }),
										arrow({ kind: "next" }),
										{
											appearance: {
												appearance: "label-sm",
												fill: "tint",
												padding: {
													blockEnd: "1.5sp",
													blockStart: "1.5sp",
													inlineEnd: "3sp",
													inlineStart: "3sp",
												},
												radius: "theme",
												tone: "muted",
											},
											bar: "12sp",
											kind: "counter",
											pad: 2,
										},
									],
									gap: "4sp",
									placement: "after",
								},
							],
							controlsGap: "8sp",
							gap: "4sp",
							label: { $text: "/accessibility/carouselLabel" },
							options: { align: "start", containScroll: false, loop: false },
							slideBasis: { base: "85%", compact: "70%", wide: "55%" },
							slides: [],
							viewportLayout: carouselOverflowViewport,
						},
						type: "carousel",
					},
				],
				gap: "12sp",
				padding: {
					base: pad({ block: "16sp", inline: "1.5rem" }),
					compact: pad({ block: "20sp", inline: "1.5rem" }),
				},
			}),
		],
		layout: clippedSectionLayout,
	}),
});
