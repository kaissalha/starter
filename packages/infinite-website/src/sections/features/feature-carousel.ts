import type { AuthoringJsonValue } from "../../document/content-schema";
import { defineSection } from "../section-definition";
import { button, kicker, media, pad, padSides, sectionRoot, text } from "./_shared/durable-parts";
import { activeDot, progressLine } from "./_shared/synced-tabs";

const slide = ({ index }: { index: number }): AuthoringJsonValue => {
	const pointer = `/features/items/${index}`;

	return {
		props: {
			align: { base: "start", wide: "center" },
			children: [
				media({
					layout: {
						blockSize: { base: "60sp", compact: "90sp" },
						inlineSize: { base: "full", wide: "50%" },
					},
					pointer,
				}),
				{
					layout: {
						inlineSize: { base: "full", wide: "50%" },
						padding: {
							base: padSides({ blockEnd: "6sp", blockStart: "6sp" }),
							compact: padSides({ blockEnd: "8sp", blockStart: "8sp" }),
							wide: pad({ block: "8sp", inline: "8sp" }),
						},
					},
					props: {
						children: [
							kicker({ pointer: `${pointer}/kicker` }),
							{
								props: {
									align: "start",
									children: [
										text({
											appearance: "display-sm",
											element: "h3",
											pointer: `${pointer}/title`,
										}),
										text({
											appearance: "body-md",
											pointer: `${pointer}/description`,
											tone: "muted",
										}),
										button({
											layout: { inlineSize: "auto", minInlineSize: "40sp" },
											pointer,
										}),
									],
									direction: "column",
									gap: "3sp",
								},
								type: "flex",
							},
						],
						direction: "column",
						gap: "4sp",
					},
					type: "flex",
				},
			],
			direction: { base: "column", wide: "row" },
		},
		type: "flex",
	};
};

const item = ({ index }: { index: number }): AuthoringJsonValue => ({
	panel: [slide({ index })],
	trigger: [text({ appearance: "heading-sm", element: "span", pointer: `/features/items/${index}/title` })],
	value: String(index),
});

const frame = {
	inlineSize: "full",
	margin: { inlineEnd: "auto", inlineStart: "auto" },
	maxInlineSize: "96rem",
} as const;

export const featureCarouselSection = defineSection({
	category: "features",
	pattern: "feature-carousel",
	repeaters: [
		{
			collection: "/features",
			createValues: ({ index }): Array<AuthoringJsonValue> => [item({ index })],
			initial: 5,
			max: 6,
			min: 2,
			target: "/props/children/0/props/items",
		},
	],
	root: sectionRoot({
		children: [
			{
				props: {
					activateOnFocus: true,
					activeShift: "0.75rem",
					arrangement: { columns: 1 },
					autoplay: { intervalMs: 5000 },
					crossfadeMs: 600,
					decorations: [...progressLine(), activeDot()],
					inactiveOpacity: 0.4,
					indicator: false,
					itemLayout: { grow: 1, minInlineSize: "max-content" },
					items: [],
					label: { $text: "/accessibility/carouselLabel" },
					listLayout: {
						...frame,
						padding: {
							base: padSides({ blockEnd: "12sp", inlineStart: "1.5rem" }),
							compact: padSides({ blockEnd: "16sp", inlineStart: "1.5rem" }),
							wide: padSides({ blockEnd: "16sp", inlineEnd: "1.5rem", inlineStart: "1.5rem" }),
						},
					},
					listPlacement: "after",
					panels: "crossfade",
					panelsLayout: {
						...frame,
						padding: {
							base: pad({ block: "12sp", inline: "1.5rem" }),
							compact: pad({ block: "16sp", inline: "1.5rem" }),
						},
					},
					tabAppearance: { padding: padSides({ blockStart: "6sp", inlineEnd: "20sp" }) },
				},
				type: "tabs",
			},
		],
	}),
});
