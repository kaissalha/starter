import type { AuthoringJsonValue } from "../../document/content-schema";
import type { Layout, SiteNodeDefinition, TabDecoration } from "../../document/structure-schema";
import { defineSection } from "../section-definition";
import { kicker, media, pad, padSides, sectionRoot, text } from "./_shared/durable-parts";

const circleSize = { base: "8sp", wide: "6sp" } as const;

const lineInset = {
	base: { blockStart: "8sp", inlineStart: "4sp" },
	wide: { blockStart: "6sp", inlineStart: "3sp" },
} as const;

const baseline: TabDecoration = {
	appearance: { fill: "border" },
	kind: "fill",
	layout: { blockSize: "full", inlineSize: "1px", inset: lineInset },
	scope: "not-last",
	source: "static",
};

const filledLine: TabDecoration = {
	appearance: { fill: "current" },
	axis: "block",
	kind: "fill",
	layout: { blockSize: "full", inlineSize: "2px", inset: lineInset },
	scope: "not-last",
	source: "completed",
	transitionMs: 400,
};

const ring: TabDecoration = {
	appearance: { foreground: "primary" },
	kind: "ring",
	layout: {
		blockSize: circleSize,
		inlineSize: circleSize,
		inset: { blockStart: "-1px", inlineStart: "-1px" },
	},
	size: "8sp",
	source: "autoplay",
	thickness: 6,
};

const trigger = ({ index }: { index: number }): SiteNodeDefinition => ({
	props: {
		align: "center",
		children: [
			{
				layout: { blockSize: circleSize, inlineSize: circleSize, shrink: 0 },
				props: {
					align: "center",
					border: { color: "border", width: "1px" },
					children: [
						text({
							align: "center",
							appearance: "label-sm",
							element: "span",
							pointer: `/features/items/${index}/number`,
							tone: "muted",
						}),
					],
					direction: "row",
					justify: "center",
					radius: "full",
				},
				type: "flex",
			},
			text({ appearance: "body-md-em", element: "span", pointer: `/features/items/${index}/title` }),
		],
		direction: "row",
		gap: { base: "6sp", compact: "4sp" },
	},
	type: "flex",
});

const item = ({ index }: { index: number }): AuthoringJsonValue => {
	const pointer = `/features/items/${index}`;

	return {
		detail: [
			text({
				appearance: "body-sm",
				layout: {
					padding: {
						base: padSides({ inlineStart: "14sp" }),
						compact: padSides({ inlineStart: "12sp" }),
						wide: padSides({ inlineStart: "10sp" }),
					},
				},
				pointer: `${pointer}/description`,
				tone: "muted",
			}),
		],
		panel: [
			media({
				layout: { blockSize: { base: "60sp", compact: "96sp", wide: "full" }, inlineSize: "full" },
				pointer,
				radius: "none",
			}),
		],
		trigger: [trigger({ index })],
		value: String(index),
	};
};

const place = ({ column, row }: { column: Layout["gridColumn"]; row: Layout["gridRow"] }): Layout => ({
	gridColumn: column,
	gridRow: row,
});

export const featureCarouselSplitSection = defineSection({
	category: "features",
	pattern: "feature-carousel-split",
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
					minBlockSize: { base: 0, wide: "viewport" },
					padding: pad({ block: 0, inline: "1.5rem" }),
					position: "relative",
				},
				props: {
					activateOnFocus: true,
					arrangement: {
						columns: { base: 1, wide: 2 },
						rowGap: "12sp",
						rows: { base: ["auto", "auto", "auto"], wide: ["auto", { fraction: 1 }] },
					},
					autoplay: { intervalMs: 5000, startDelayMs: 400 },
					crossfadeMs: 600,
					decorations: [baseline, filledLine, ring],
					inactiveOpacity: 0.6,
					indicator: false,
					items: [],
					label: { $text: "/accessibility/carouselLabel" },
					lead: [
						{
							layout: {
								...place({
									column: { base: { span: 1, start: 1 }, wide: { span: 1, start: 2 } },
									row: { base: { span: 1, start: 2 }, wide: { span: 1, start: 1 } },
								}),
								padding: {
									base: padSides({ blockStart: "12sp" }),
									compact: padSides({ blockStart: "16sp" }),
									wide: padSides({ blockStart: "16sp", inlineStart: "16sp" }),
								},
							},
							props: {
								children: [
									kicker({}),
									{
										props: {
											children: [
												text({
													appearance: "heading-sm",
													element: "h2",
													pointer: "/copy/heading",
												}),
												text({
													appearance: "body-md",
													pointer: "/copy/description",
													tone: "muted",
												}),
											],
											direction: "column",
											gap: "4sp",
										},
										type: "flex",
									},
								],
								direction: "column",
								gap: "2sp",
							},
							type: "flex",
						},
					],
					listAppearance: { gap: "6sp" },
					listLayout: {
						...place({
							column: { base: { span: 1, start: 1 }, wide: { span: 1, start: 2 } },
							row: { base: { span: 1, start: 3 }, wide: { span: 1, start: 2 } },
						}),
						padding: {
							base: padSides({ blockEnd: "12sp" }),
							compact: padSides({ blockEnd: "16sp" }),
							wide: padSides({ blockEnd: "16sp", inlineStart: "16sp" }),
						},
					},
					orientation: "vertical",
					panels: "crossfade",
					panelsLayout: {
						...place({
							column: { base: { span: 1, start: 1 }, wide: { span: 2, start: 1 } },
							row: { base: { span: 1, start: 1 }, wide: { span: 2, start: 1 } },
						}),
						inlineSize: { base: "auto", wide: "50cqw" },
						inset: { base: {}, wide: { blockEnd: 0, blockStart: 0, inlineStart: "viewport-bleed-offset" } },
						margin: {
							base: { inlineEnd: "-1.5rem", inlineStart: "-1.5rem" },
							wide: { inlineEnd: 0, inlineStart: 0 },
						},
						position: { base: "static", wide: "absolute" },
					},
				},
				type: "tabs",
			},
		],
	}),
});
