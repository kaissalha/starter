import type { Layout, Responsive, SiteNodeDefinition } from "../../../document/structure-schema";
import { box, flex, space, text } from "../../metrics/_shared/parts";
import type { SectionRepeater } from "../../section-definition";

type Node = SiteNodeDefinition;

export const planCellLayout: Layout = { grow: 1, inlineSize: { base: "auto", wide: 0 }, minInlineSize: 0 };

export const planItem = ({ field, index }: { field: string; index: number }) => `/items/items/${index}/${field}`;

export const planFeature = ({ feature, index }: { feature: number; index: number }) =>
	planItem({ field: `features/items/${feature}/title`, index });

export const planFeaturesRepeater = ({
	createFeature,
	initial = 3,
	max = 8,
	min = 1,
	target,
}: {
	createFeature: ({ feature, index }: { feature: number; index: number }) => Node;
	initial?: number;
	max?: number;
	min?: number;
	target: string;
}): SectionRepeater => ({
	collection: "/items/*/features",
	createValues: ({ index, parentIndex }) => [createFeature({ feature: index, index: parentIndex })],
	initial,
	max,
	min,
	target,
});

export const rule = ({
	layout,
	visibility,
}: {
	layout: Layout;
	visibility?: Responsive<"visible" | "removed">;
}): Node =>
	box({
		decorative: true,
		fill: "border",
		layout: { position: "absolute", ...(visibility && { visibility }), ...layout },
	});

export const topRule = ({ visibility }: { visibility?: Responsive<"visible" | "removed"> } = {}): Node =>
	rule({ layout: { blockSize: 1, inset: { blockStart: 0, inlineEnd: 0, inlineStart: 0 } }, visibility });

export const bottomRule = ({ visibility }: { visibility?: Responsive<"visible" | "removed"> } = {}): Node =>
	rule({ layout: { blockSize: 1, inset: { blockEnd: 0, inlineEnd: 0, inlineStart: 0 } }, visibility });

export const startRule = ({ visibility }: { visibility?: Responsive<"visible" | "removed"> } = {}): Node =>
	rule({ layout: { inlineSize: 1, inset: { blockEnd: 0, blockStart: 0, inlineStart: 0 } }, visibility });

export const endRule = ({ visibility }: { visibility?: Responsive<"visible" | "removed"> } = {}): Node =>
	rule({ layout: { inlineSize: 1, inset: { blockEnd: 0, blockStart: 0, inlineEnd: 0 } }, visibility });

export const checkMark = (): Node => ({
	layout: { shrink: 0 },
	props: { name: "check", size: "4sp", tone: "accent-text" },
	type: "icon",
});

export const dotMark = (): Node => ({
	layout: { margin: { inlineStart: "-1.5sp" }, shrink: 0 },
	props: { name: "dot", size: "4sp", tone: "current" },
	type: "icon",
});

export const checkRow = ({
	align = "start",
	appearance = "body-sm",
	gap = 2,
	pointer,
	tone,
}: {
	align?: "start" | "center";
	appearance?: "body-sm";
	gap?: number;
	pointer: string;
	tone?: "muted";
}): Node =>
	flex({
		align,
		children: [checkMark(), text({ appearance, pointer, ...(tone && { tone }) })],
		direction: "row",
		gap: space(gap),
	});

export const hiddenUnlessFeatured = ({ featured }: { featured: boolean }): Layout =>
	featured ? {} : { visibility: "removed" };
