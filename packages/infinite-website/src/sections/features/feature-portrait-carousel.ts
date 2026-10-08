import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { carouselOverflowViewport, clippedSectionLayout } from "./_shared/durable-carousel";
import { contentFrame, flex, image, kicker, sectionBox, text } from "./_shared/section-parts";

type Carousel = Extract<SiteNodeDefinition, { type: "carousel" }>;

type Control = Carousel["props"]["controlGroups"][number]["controls"][number];

const arrow = ({ kind }: { kind: "next" | "previous" }): Control => ({
	appearance: { fill: "tint", foreground: "primary", radius: "theme" },
	corners: "square",
	iconSize: "5sp",
	kind,
	label: { $text: `/accessibility/${kind}Label` },
	size: "11sp",
});

type ControlGroup = Carousel["props"]["controlGroups"][number];

const arrows = ({ placement, visibility }: { placement: "after" | "header"; visibility: "compact" | "base" }) =>
	({
		align: "start",
		controls: [arrow({ kind: "previous" }), arrow({ kind: "next" })],
		gap: "3sp",
		layout: {
			visibility:
				visibility === "base"
					? { base: "visible", compact: "removed" }
					: { base: "removed", compact: "visible" },
		},
		placement,
	}) satisfies Omit<ControlGroup, "id">;

export const featurePortraitCarouselSection = defineSection({
	category: "features",
	pattern: "feature-portrait-carousel",
	repeaters: [
		{
			collection: "/items",
			createValues: ({ index }) => [
				flex({
					children: [
						image({
							aspectRatio: { height: 5, width: 4 },
							inlineSize: "full",
							pointer: `/items/items/${index}`,
						}),
						flex({
							children: [
								text({
									appearance: "heading-sm",
									element: "h3",
									pointer: `/items/items/${index}/title`,
								}),
								text({
									appearance: "body-sm",
									pointer: `/items/items/${index}/description`,
									tone: "muted",
								}),
							],
							gap: "2sp",
						}),
					],
					gap: "4sp",
				}),
			],
			initial: 5,
			max: 8,
			min: 2,
			target: "/props/children/0/props/children/0/props/slides",
		},
	],
	root: sectionBox({
		children: [
			contentFrame({
				children: [
					{
						props: {
							controlGroups: [
								arrows({ placement: "header", visibility: "compact" }),
								arrows({ placement: "after", visibility: "base" }),
							],
							controlsGap: "8sp",
							gap: "3sp",
							header: {
								align: { base: "stretch", wide: "end" },
								children: [
									flex({
										children: [
											kicker(),
											text({ appearance: "display-sm", element: "h2", pointer: "/copy/heading" }),
										],
										gap: "4sp",
										layout: { inlineSize: { base: "full", compact: "66.6667%", wide: "50%" } },
									}),
								],
								direction: { base: "column", wide: "row" },
								gap: "8sp",
								justify: "between",
								layout: { padding: { blockEnd: "4sp" } },
							},
							inactiveOpacity: 1,
							label: { $text: "/accessibility/carouselLabel" },
							options: { align: "start", containScroll: "trim-snaps", loop: false },
							slideBasis: { base: "87.5%", compact: "75%", wide: "50%" },
							slides: [],
							viewportLayout: carouselOverflowViewport,
						},
						type: "carousel",
					},
				],
				gap: "12sp",
				padding: { base: "16sp", compact: "20sp" },
			}),
		],
		layout: clippedSectionLayout,
	}),
});
