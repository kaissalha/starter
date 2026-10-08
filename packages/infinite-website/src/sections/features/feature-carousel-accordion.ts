import type { AuthoringJsonValue } from "../../document/content-schema";
import type { SiteNodeDefinition, TabDecoration } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { kicker, media, pad, padSides, sectionRoot, text } from "./_shared/durable-parts";

const chip = { blockSize: { base: "12sp", wide: "10sp" }, inlineSize: { base: "8sp", wide: "7sp" } } as const;

const column = (start: number) => ({ base: { span: 1, start: 1 }, wide: { span: 1, start } });

const divider: TabDecoration = {
	appearance: { fill: "border" },
	kind: "fill",
	layout: {
		blockSize: "1px",
		inset: { blockStart: 0, inlineEnd: 0, inlineStart: 0 },
		visibility: { base: "visible", compact: "removed" },
	},
	source: "static",
};

const connector: TabDecoration = {
	appearance: { fill: "border" },
	kind: "fill",
	layout: {
		inlineSize: "1px",
		inset: { blockEnd: 0, blockStart: "10sp", inlineStart: "3.5sp" },
		visibility: { base: "removed", compact: "visible" },
	},
	scope: "not-last",
	source: "static",
};

const highlight: TabDecoration = {
	appearance: { fill: "border" },
	axis: "none",
	kind: "fill",
	layout: {
		...chip,
		inset: { base: { blockStart: "4sp", inlineStart: 0 }, compact: { blockStart: 0, inlineStart: 0 } },
	},
	source: "active",
	transitionMs: 200,
};

const trigger = ({ index }: { index: number }): SiteNodeDefinition => ({
	layout: { inlineSize: "full" },
	props: {
		align: { base: "center", compact: "start" },
		children: [
			{
				layout: chip,
				props: {
					align: "center",
					border: { color: "border", width: "1px" },
					children: [
						text({
							align: "center",
							appearance: "label-md",
							element: "span",
							pointer: `/features/items/${index}/number`,
							tone: "muted",
						}),
					],
					direction: "row",
					justify: "center",
				},
				type: "flex",
			},
			text({ appearance: "heading-sm", element: "span", pointer: `/features/items/${index}/title` }),
			{
				layout: { grow: 1, visibility: { base: "visible", compact: "removed" } },
				props: {
					align: "center",
					children: [{ props: { name: "chevron-down", size: "4sp", tone: "accent-text" }, type: "icon" }],
					direction: "row",
					justify: "end",
				},
				type: "flex",
			},
		],
		direction: "row",
		gap: "6sp",
	},
	type: "flex",
});

const item = ({ index }: { index: number }): AuthoringJsonValue => {
	const pointer = `/features/items/${index}`;

	return {
		detail: [
			media({
				layout: {
					blockSize: "60sp",
					inlineSize: "full",
					margin: { blockStart: "4sp" },
					visibility: { base: "visible", compact: "removed" },
				},
				pointer,
			}),
			text({
				appearance: "body-sm",
				layout: {
					margin: { base: { blockStart: "4sp" }, compact: { blockStart: 0 } },
					padding: { base: padSides({}), compact: padSides({ inlineStart: "13sp" }) },
				},
				pointer: `${pointer}/description`,
				tone: "muted",
			}),
		],
		panel: [media({ layout: { blockSize: "110sp", inlineSize: "full" }, pointer })],
		trigger: [trigger({ index })],
		value: String(index),
	};
};

export const featureCarouselAccordionSection = defineSection({
	category: "features",
	pattern: "feature-carousel-accordion",
	repeaters: [
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [item({ index })],
			initial: 5,
			max: 8,
			min: 2,
			target: "/props/children/0/props/items",
		},
	],
	root: sectionRoot({
		children: [
			{
				layout: {
					inlineSize: "full",
					margin: { inlineEnd: "auto", inlineStart: "auto" },
					maxInlineSize: "96rem",
					padding: {
						base: pad({ block: "12sp", inline: "1.5rem" }),
						compact: pad({ block: "16sp", inline: "1.5rem" }),
					},
				},
				props: {
					activateOnFocus: true,
					arrangement: {
						align: { base: "stretch", wide: "end" },
						columnGap: "16sp",
						columns: { base: 1, wide: 2 },
						rowGap: { base: "8sp", compact: "6sp" },
					},
					decorations: [divider, connector, highlight],
					inactiveOpacity: 0.4,
					indicator: false,
					itemLayout: {
						padding: {
							base: { blockEnd: "4sp", blockStart: "4sp" },
							compact: { blockEnd: "10sp", blockStart: 0 },
						},
					},
					items: [],
					label: { $text: "/accessibility/carouselLabel" },
					lead: [
						{
							layout: { gridColumn: column(1), gridRow: { base: { span: 1, start: 1 } } },
							props: {
								children: [
									kicker({}),
									{
										props: {
											children: [
												text({
													appearance: "display-sm",
													element: "h2",
													pointer: "/copy/heading",
												}),
												text({
													appearance: "body-lg",
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
					],
					listLayout: {
						gridColumn: column(2),
						gridRow: {
							base: { span: 1, start: 2 },
							compact: { span: 1, start: 3 },
							wide: { span: 2, start: 1 },
						},
						margin: { base: { blockStart: 0 }, compact: { blockStart: "6sp" }, wide: { blockStart: 0 } },
					},
					listPlacement: "after",
					openIndicator: "rotate-180",
					orientation: "vertical",
					panels: "crossfade",
					panelsLayout: {
						gridColumn: column(1),
						gridRow: { base: { span: 1, start: 2 } },
						visibility: { base: "removed", compact: "visible" },
					},
				},
				type: "tabs",
			},
		],
	}),
});
