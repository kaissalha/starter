import type { AuthoringJsonValue } from "../../document/content-schema";
import { activeDot, progressLine } from "../features/_shared/synced-tabs";
import { defineSection } from "../section-definition";
import { box, flex, kicker, media, sectionBox, text } from "./_shared/section-parts";

const frame = {
	inlineSize: "full",
	margin: { inlineEnd: "auto", inlineStart: "auto" },
	maxInlineSize: "96rem",
} as const;

const item = ({ index }: { index: number }): AuthoringJsonValue => ({
	panel: [
		media({
			aspectRatio: { height: 7, width: 14 },
			layout: { inlineSize: "full" },
			pointer: `/slides/items/${index}`,
		}),
	],
	trigger: [text({ appearance: "heading-sm", element: "span", pointer: `/slides/items/${index}/label` })],
	value: String(index),
});

export const gallerySlideshowLabelledSection = defineSection({
	category: "gallery",
	pattern: "gallery-slideshow-labelled",
	repeaters: [
		{
			collection: "/slides",
			createValues: ({ index }) => [item({ index })],
			initial: 3,
			max: 8,
			min: 2,
			target: "/props/children/0/props/items",
		},
	],
	root: sectionBox({
		children: [
			{
				layout: frame,
				props: {
					activateOnFocus: true,
					arrangement: { columns: 1 },
					autoplay: { intervalMs: 5000 },
					decorations: [...progressLine(), activeDot()],
					inactiveOpacity: 0.4,
					indicator: false,
					itemLayout: { grow: 1, minInlineSize: "max-content" },
					items: [],
					label: { $text: "/accessibility/carouselLabel" },
					lead: [
						flex({
							children: [
								flex({
									children: [
										kicker(),
										text({
											appearance: "display-sm",
											element: "h2",
											pointer: "/copy/heading",
											tone: "primary",
										}),
									],
									gap: "2sp",
									layout: { inlineSize: { base: "full", wide: "50%" } },
								}),
								box({
									children: [
										text({ appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
									],
									layout: {
										inlineSize: { base: "full", wide: "50%" },
										padding: { base: {}, wide: { blockStart: "11sp" } },
									},
								}),
							],
							direction: { base: "column", wide: "row" },
							gap: { base: "4sp", wide: "8sp" },
							layout: {
								padding: {
									base: {
										blockStart: "12sp",
										inlineEnd: "1.5rem",
										inlineStart: "1.5rem",
									},
									compact: { blockStart: "16sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
								},
							},
						}),
					],
					listLayout: {
						padding: {
							base: { blockEnd: "12sp", inlineEnd: 0, inlineStart: "1.5rem" },
							compact: { blockEnd: "16sp", inlineEnd: 0, inlineStart: "1.5rem" },
							wide: { blockEnd: "16sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
						},
					},
					listPlacement: "after",
					panels: "track",
					panelsLayout: {
						padding: {
							base: { blockEnd: "8sp", blockStart: "6sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
						},
					},
					slideBasis: { base: "97%", compact: "100%", wide: "92%" },
					slideGap: "4sp",
					tabAppearance: { padding: { blockStart: "6sp", inlineEnd: "20sp" } },
				},
				type: "tabs",
			},
		],
	}),
});
