import type { Alignment, Foreground, Layout, Length, SiteNodeDefinition } from "../../../document/structure-schema";

type CarouselDefinition = Extract<SiteNodeDefinition, { type: "carousel" }>;

type ControlGroup = CarouselDefinition["props"]["controlGroups"][number];

export const dotsGroup = ({
	activeSize = "2rem",
	align = "start",
	foreground = "accent",
	layout,
}: {
	activeSize?: Length;
	align?: Alignment;
	foreground?: Foreground;
	layout?: Layout;
} = {}): ControlGroup => ({
	align,
	controls: [
		{
			active: { blockSize: "0.5rem", inlineSize: activeSize, opacity: 1 },
			appearance: { foreground },
			inactive: { blockSize: "0.5rem", inlineSize: "0.5rem", opacity: 0.3 },
			kind: "indicators",
			label: { $text: "/accessibility/indicatorsLabel" },
		},
	],
	layout,
	placement: "after",
});

export const arrowsGroup = ({
	align = "start",
	layout,
	placement = "after",
}: {
	align?: Alignment;
	layout?: Layout;
	placement?: ControlGroup["placement"];
} = {}): ControlGroup => ({
	align,
	controls: [
		{
			appearance: { fill: "subtle", foreground: "primary", radius: "full" },
			kind: "previous",
			label: { $text: "/accessibility/previousLabel" },
		},
		{
			appearance: { fill: "subtle", foreground: "primary", radius: "full" },
			kind: "next",
			label: { $text: "/accessibility/nextLabel" },
		},
	],
	gap: "1rem",
	layout,
	placement,
});

export const carouselViewport = { inlineSize: "full", margin: { inlineEnd: 0, inlineStart: 0 } } satisfies Layout;

export const carouselOverflowViewport = {
	inlineSize: "full",
	margin: { inlineEnd: 0, inlineStart: 0 },
	overflow: "visible",
} satisfies Layout;

export const clippedSectionLayout = { overflow: "clip" } satisfies Layout;
