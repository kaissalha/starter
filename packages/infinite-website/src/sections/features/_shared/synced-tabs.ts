import type { Layout, TabDecoration } from "../../../document/structure-schema";

const topEdge = { blockSize: "1px", inset: { blockStart: 0, inlineEnd: 0, inlineStart: 0 } } satisfies Layout;

export const progressLine = ({ layout = topEdge }: { layout?: Layout } = {}): Array<TabDecoration> => [
	{ appearance: { fill: "border" }, kind: "fill", layout, source: "static" },
	{ appearance: { fill: "current" }, axis: "inline", kind: "fill", layout, source: "autoplay" },
];

export const activeDot = ({ blockStart = "9sp" }: { blockStart?: string } = {}): TabDecoration => ({
	appearance: { fill: "current", radius: "full" },
	axis: "both",
	kind: "fill",
	layout: { blockSize: "1sp", inlineSize: "1sp", inset: { blockStart, inlineStart: "-3sp" } },
	source: "active",
	transitionMs: 200,
});
