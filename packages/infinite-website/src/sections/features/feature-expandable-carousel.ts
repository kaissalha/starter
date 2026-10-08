import type { AuthoringJsonValue } from "../../document/content-schema";
import type { SiteNodeDefinition } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { carouselViewport, dotsGroup } from "./_shared/durable-carousel";
import { buttonGroup, kicker, pad, sectionContent, sectionRoot, text } from "./_shared/durable-parts";

const badge = ({ index }: { index: number }): SiteNodeDefinition => ({
	layout: { blockSize: "12sp", inlineSize: "12sp", shrink: 0 },
	props: {
		align: "center",
		border: { color: "border", width: "2px" },
		children: [
			text({ align: "center", appearance: "title-lg", element: "span", pointer: `/features/items/${index}/tag` }),
		],
		direction: "row",
		fill: "canvas",
		justify: "center",
		radius: "theme",
	},
	type: "flex",
});

const title = ({ element = "h3", index }: { element?: "h3" | "span"; index: number }): SiteNodeDefinition => ({
	layout: { grow: 1, padding: { blockStart: "1.5sp" } },
	props: {
		children: [text({ appearance: "heading-md", element, pointer: `/features/items/${index}/title` })],
		direction: "column",
	},
	type: "flex",
});

const description = ({ index }: { index: number }) =>
	text({ appearance: "body-md", pointer: `/features/items/${index}/description`, tone: "muted" });

const card = ({
	children,
	layout,
}: {
	children: Array<SiteNodeDefinition>;
	layout: SiteNodeDefinition["layout"];
}): SiteNodeDefinition => ({
	layout: { ...layout, padding: pad({ block: "6sp", inline: "6sp" }) },
	props: { children, direction: "column", fill: "tint", justify: "between", radius: "theme" },
	type: "flex",
});

const expandableItem = ({ index }: { index: number }): AuthoringJsonValue => ({
	detail: [
		text({
			appearance: "body-md",
			pointer: `/features/items/${index}/description`,
			tone: "muted",
		}),
	],
	panel: [],
	trigger: [
		{
			props: { children: [badge({ index }), title({ element: "span", index })], direction: "row", gap: "6sp" },
			type: "flex",
		},
	],
	value: String(index),
});

const slide = ({ index }: { index: number }): AuthoringJsonValue =>
	card({
		children: [
			{ props: { children: [badge({ index }), title({ index })], direction: "row", gap: "6sp" }, type: "flex" },
			description({ index }),
		],
		layout: { minBlockSize: "80sp" },
	});

export const featureExpandableCarouselSection = defineSection({
	category: "features",
	pattern: "feature-expandable-carousel",
	repeaters: [
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [expandableItem({ index })],
			initial: 4,
			max: 6,
			min: 2,
			target: "/props/children/0/props/children/1/props/items",
		},
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [slide({ index })],
			initial: 4,
			max: 6,
			min: 2,
			target: "/props/children/0/props/children/2/props/slides",
		},
	],
	root: sectionRoot({
		children: [
			sectionContent({
				children: [
					{
						props: {
							align: "start",
							children: [
								{
									layout: { inlineSize: "full" },
									props: {
										children: [
											{
												props: {
													children: [
														kicker({}),
														text({
															appearance: "display-sm",
															element: "h2",
															pointer: "/copy/heading",
														}),
													],
													direction: "column",
													gap: "2sp",
												},
												type: "flex",
											},
											text({
												appearance: "body-lg",
												layout: { maxInlineSize: "48rem" },
												pointer: "/copy/description",
												tone: "muted",
											}),
										],
										direction: "column",
										gap: "4sp",
									},
									type: "flex",
								},
								buttonGroup({ variants: ["primary", "secondary"] }),
							],
							direction: "column",
							gap: "6sp",
						},
						type: "flex",
					},
					{
						layout: { visibility: { base: "removed", wide: "visible" } },
						props: {
							activateOnFocus: true,
							autoplay: { intervalMs: 3000, pauseOnHover: true },
							expandActive: { inactiveSize: "24sp" },
							indicator: false,
							itemAppearance: {
								fill: "tint",
								padding: pad({ block: "6sp", inline: "6sp" }),
								radius: "theme",
							},
							itemFlex: { direction: "column", justify: "between" },
							items: [],
							label: { $text: "/accessibility/carouselLabel" },
							listAppearance: { gap: "4sp" },
							listLayout: { blockSize: "120sp" },
							panelsLayout: { visibility: "removed" },
						},
						type: "tabs",
					},
					{
						layout: { visibility: { base: "visible", wide: "removed" } },
						props: {
							controlGroups: [dotsGroup({ layout: { margin: { blockStart: "-1.5rem" } } })],
							gap: "4sp",
							label: { $text: "/accessibility/carouselLabel" },
							options: { align: "start", loop: false },
							slideBasis: "100%",
							slides: [],
							viewportLayout: carouselViewport,
						},
						type: "carousel",
					},
				],
				gap: { base: "8sp", compact: "12sp", wide: "16sp" },
				padding: {
					base: pad({ block: "12sp", inline: "1.5rem" }),
					compact: pad({ block: "16sp", inline: "1.5rem" }),
				},
			}),
		],
	}),
});
