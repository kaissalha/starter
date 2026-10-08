import { z } from "zod";

import type {
	Edges,
	Fill,
	Foreground,
	Layout,
	Length,
	Responsive,
	SiteNodeDefinition,
	TypographyAppearance,
} from "../../../document/structure-schema";

type Node = SiteNodeDefinition;

type Align = "start" | "center" | "end";

type CrossAlign = Align | "stretch";

type Justify = Align | "between" | "around" | "evenly";

type Track = { fraction: number } | Length;

type Border = {
	color: "border" | "current";
	sides?: Array<"block-start" | "block-end" | "inline-start" | "inline-end">;
	width: number;
};

export const box = ({
	border,
	children = [],
	decorative,
	fill,
	layout,
	pattern,
	radius,
}: {
	border?: Border;
	children?: Array<Node>;
	decorative?: boolean;
	fill?: Fill;
	layout?: Layout;
	pattern?: "diagonal-slash";
	radius?: "theme" | "none" | "full";
}): Node => ({
	...(layout && { layout }),
	props: {
		children,
		...(border && { border }),
		...(decorative && { decorative }),
		...(fill && { fill }),
		...(pattern && { pattern }),
		...(radius && { radius }),
	},
	type: "box",
});

export const sectionBox = ({ children, layout }: { children: Array<Node>; layout?: Layout }): Node =>
	box({ children, fill: "canvas", ...(layout && { layout }) });

export const flex = ({
	align,
	border,
	children,
	direction = "column",
	fill,
	gap,
	justify,
	layout,
	radius,
	wrap,
}: {
	align?: Responsive<CrossAlign>;
	border?: Border;
	children: Array<Node>;
	direction?: Responsive<"row" | "column" | "row-reverse" | "column-reverse">;
	fill?: Fill;
	gap?: Responsive<Length>;
	justify?: Responsive<Justify>;
	layout?: Layout;
	radius?: "theme" | "none" | "full";
	wrap?: Responsive<"nowrap" | "wrap">;
}): Node => ({
	...(layout && { layout }),
	props: {
		children,
		direction,
		...(align && { align }),
		...(border && { border }),
		...(fill && { fill }),
		...(gap !== undefined && { gap }),
		...(justify && { justify }),
		...(radius && { radius }),
		...(wrap && { wrap }),
	},
	type: "flex",
});

export const grid = ({
	align,
	border,
	children,
	columnGap,
	columns,
	fill,
	gap,
	layout,
	radius,
	rowGap,
	rows,
}: {
	align?: Responsive<CrossAlign>;
	border?: Border;
	children: Array<Node>;
	columnGap?: Responsive<Length>;
	columns: Responsive<number | Array<Track>>;
	fill?: Fill;
	gap?: Responsive<Length>;
	layout?: Layout;
	radius?: "theme" | "none" | "full";
	rowGap?: Responsive<Length>;
	rows?: Responsive<number | Array<Track>>;
}): Node => ({
	...(layout && { layout }),
	props: {
		children,
		columns,
		...(align && { align }),
		...(border && { border }),
		...(columnGap !== undefined && { columnGap }),
		...(fill && { fill }),
		...(gap !== undefined && { gap }),
		...(radius && { radius }),
		...(rowGap !== undefined && { rowGap }),
		...(rows !== undefined && { rows }),
	},
	type: "grid",
});

type Steps = number | { base: number; compact?: number; wide?: number };

type Breakpoint = "base" | "compact" | "wide";

type PadInput = { bottom?: Steps; end?: Steps; start?: Steps; top?: Steps; x?: Steps; y?: Steps };

const stepObjectSchema = z.compile(
	z.object({ base: z.number(), compact: z.number().optional(), wide: z.number().optional() })
);

const sp = (steps: number) => `${steps}sp`;

export const space = (steps: Steps): Responsive<Length> => {
	const parsed = stepObjectSchema.safeParse(steps);

	if (!parsed.success) {
		return sp(Number(steps));
	}

	const result: Extract<Responsive<Length>, { base: Length }> = { base: sp(parsed.data.base) };

	if (parsed.data.compact !== undefined) {
		result.compact = sp(parsed.data.compact);
	}

	if (parsed.data.wide !== undefined) {
		result.wide = sp(parsed.data.wide);
	}

	return result;
};

const stepAt = ({ breakpoint, steps }: { breakpoint: Breakpoint; steps: Steps }) => {
	const parsed = stepObjectSchema.safeParse(steps);

	if (!parsed.success) {
		return Number(steps);
	}

	const compact = parsed.data.compact ?? parsed.data.base;

	return { base: parsed.data.base, compact, wide: parsed.data.wide ?? compact }[breakpoint];
};

const padAt = ({ breakpoint, values }: { breakpoint: Breakpoint; values: PadInput }): Edges<Length> => {
	const edges: Edges<Length> = {};

	const entries = [
		["blockEnd", values.bottom ?? values.y],
		["blockStart", values.top ?? values.y],
		["inlineEnd", values.end ?? values.x],
		["inlineStart", values.start ?? values.x],
	] as const;

	entries.forEach(([edge, steps]) => {
		if (steps !== undefined) {
			edges[edge] = sp(stepAt({ breakpoint, steps }));
		}
	});

	return edges;
};

export const pad = (values: PadInput) => ({
	base: padAt({ breakpoint: "base", values }),
	compact: padAt({ breakpoint: "compact", values }),
	wide: padAt({ breakpoint: "wide", values }),
});

type FrameInline = { base: Length; compact?: Length; wide?: Length };

const defaultInline: FrameInline = { base: "1.5rem" };

export const frameLayout = ({
	bottom,
	inline = defaultInline,
	maxInlineSize = "96rem",
	top,
	y,
}: {
	bottom?: Steps;
	inline?: FrameInline;
	maxInlineSize?: Length;
	top?: Steps;
	y?: Steps;
}): Layout => {
	const padding = pad({ bottom, top, y });
	const compact = inline.compact ?? inline.base;
	const wide = inline.wide ?? compact;

	return {
		inlineSize: "full",
		margin: { inlineEnd: "auto", inlineStart: "auto" },
		maxInlineSize,
		padding: {
			base: { ...padding.base, inlineEnd: inline.base, inlineStart: inline.base },
			compact: { ...padding.compact, inlineEnd: compact, inlineStart: compact },
			wide: { ...padding.wide, inlineEnd: wide, inlineStart: wide },
		},
	};
};

export const text = ({
	align,
	appearance,
	element = "p",
	layout,
	pointer,
	tone,
	transform,
	wrap,
}: {
	align?: Align;
	appearance: TypographyAppearance;
	element?: "p" | "span" | "h1" | "h2" | "h3" | "h4";
	layout?: Layout;
	pointer: string;
	tone?: Foreground;
	transform?: "none" | "uppercase";
	wrap?: "balance" | "pretty";
}): Node => ({
	...(layout && { layout }),
	props: {
		appearance,
		content: { $text: pointer },
		element,
		font: element.startsWith("h") || appearance.startsWith("display") ? "brand" : "body",
		...(align && { align }),
		...(tone && { tone }),
		...(transform && { transform }),
		...(wrap && { wrap }),
	},
	type: "text",
});

export const kicker = ({ pointer = "/copy/kicker" }: { pointer?: string } = {}): Node =>
	text({ appearance: "label-md", pointer, tone: "muted" });

export const verticalDivider = (): Node =>
	box({ decorative: true, fill: "border", layout: { inlineSize: 1, shrink: 0 } });

export const horizontalDivider = ({ layout }: { layout?: Layout } = {}): Node =>
	box({ decorative: true, fill: "border", layout: { blockSize: 1, inlineSize: "full", ...layout } });

const buttonStyles = {
	outline: { border: { color: "current", width: "1px" }, fill: "transparent" },
	primary: { fill: "action", foreground: "action" },
	secondary: { fill: "subtle", foreground: "primary" },
} satisfies Record<string, Partial<Extract<Node, { type: "action" }>["props"]>>;

export const actionButton = ({
	appearance = "primary",
	fullWidth = false,
	index = 0,
	labelPointer = `/actions/items/${index}/label`,
	linkPointer = `/actions/items/${index}/link`,
}: {
	appearance?: keyof typeof buttonStyles;
	fullWidth?: boolean | "mobile";
	index?: number;
	labelPointer?: string;
	linkPointer?: string;
}): Node => ({
	layout: {
		padding: pad({ x: 5, y: 2.5 }),
		...(fullWidth === true && { inlineSize: "full" }),
		...(fullWidth === "mobile" && { inlineSize: { base: "full", compact: "auto" } }),
	},
	props: {
		children: [text({ appearance: "body-sm-em", element: "span", pointer: labelPointer, tone: "current" })],
		href: { $link: linkPointer },
		radius: "theme",
		...buttonStyles[appearance],
	},
	type: "action",
});

export const buttonRow = ({
	appearances,
	layout,
}: {
	appearances: Array<keyof typeof buttonStyles>;
	layout?: Layout;
}): Node =>
	flex({
		children: appearances.map((appearance, index) => actionButton({ appearance, fullWidth: "mobile", index })),
		direction: "row",
		gap: space(4),
		...(layout && { layout }),
		wrap: "wrap",
	});
