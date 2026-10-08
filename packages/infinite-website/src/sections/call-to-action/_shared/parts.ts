import type { Foreground, Layout, SiteNodeDefinition, TypographyAppearance } from "../../../document/structure-schema";
import type { SectionRepeater } from "../../section-definition";

type Block = [start: string, end: string];

export const contentLayout = {
	inlineSize: "full",
	margin: { inlineEnd: "auto", inlineStart: "auto" },
	maxInlineSize: "96rem",
} satisfies Layout;

export const sectionPadding = ({
	base,
	compact,
	inline = "1.5rem",
	wide,
}: {
	base: Block;
	compact?: Block;
	inline?: string;
	wide?: Block;
}) => {
	const edges = ([blockStart, blockEnd]: Block) => ({ blockEnd, blockStart, inlineEnd: inline, inlineStart: inline });

	return {
		base: edges(base),
		...(compact && { compact: edges(compact) }),
		...(wide && { wide: edges(wide) }),
	} satisfies Layout["padding"];
};

export const textNode = ({
	align = "start",
	appearance,
	element = "p",
	layout,
	pointer,
	tone = "primary",
	wrap,
}: {
	align?: "center" | "end" | "start";
	appearance: TypographyAppearance;
	element?: "h2" | "h3" | "p" | "span";
	layout?: Layout;
	pointer: string;
	tone?: Foreground;
	wrap?: "balance" | "pretty";
}) => {
	return {
		...(layout && { layout }),
		props: {
			align,
			appearance,
			content: { $text: pointer },
			element,
			...(element.startsWith("h") && { font: "brand" as const }),
			tone,
			...(wrap && { wrap }),
		},
		type: "text",
	} satisfies SiteNodeDefinition;
};

export type ButtonKind = "outline" | "primary" | "secondary";

const buttonAppearance = {
	outline: { border: { color: "current", width: "1px" }, fill: "transparent" },
	primary: { fill: "action", foreground: "action" },
	secondary: { fill: "subtle", foreground: "primary" },
} as const;

export const actionNode = ({ index, kind, layout }: { index: number; kind: ButtonKind; layout?: Layout }) => {
	return {
		layout: {
			padding: { blockEnd: "2.5sp", blockStart: "2.5sp", inlineEnd: "5sp", inlineStart: "5sp" },
			...layout,
		},
		props: {
			...buttonAppearance[kind],
			children: [
				textNode({
					appearance: "body-sm-em",
					element: "span",
					pointer: `/actions/items/${index}/label`,
					tone: "current",
				}),
			],
			href: { $link: `/actions/items/${index}/link` },
			radius: "theme",
		},
		type: "action",
	} satisfies SiteNodeDefinition;
};

export const buttonRow = ({ justify = "start", layout }: { justify?: "center" | "end" | "start"; layout?: Layout }) => {
	return {
		...(layout && { layout }),
		props: {
			align: { base: "stretch", compact: "center" },
			children: [],
			direction: { base: "column", compact: "row" },
			gap: "4sp",
			justify: { base: "start", compact: justify },
			wrap: "wrap",
		},
		type: "flex",
	} satisfies SiteNodeDefinition;
};

export const actionsRepeater = ({
	initial,
	kinds,
	min = 1,
	target,
}: {
	initial?: number;
	kinds: Array<ButtonKind>;
	min?: number;
	target: string;
}) => {
	return {
		collection: "/actions",
		createValues: ({ index }) => [
			actionNode({
				index,
				kind: kinds[index] ?? "secondary",
				layout: { inlineSize: { base: "full", compact: "auto" } },
			}),
		],
		initial: initial ?? kinds.length,
		max: kinds.length,
		min,
		target,
	} satisfies SectionRepeater;
};
