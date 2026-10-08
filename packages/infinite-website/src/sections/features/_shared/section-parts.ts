import type {
	Border,
	Fill,
	Foreground,
	Layout,
	Length,
	MediaOverlay,
	Responsive,
	SiteNodeDefinition,
	TypographyAppearance,
} from "../../../document/structure-schema";

type Node = SiteNodeDefinition;

type Align = "start" | "center" | "end";

type CrossAlign = Align | "stretch";

type Justify = Align | "between" | "around" | "evenly";

type BlockPadding = { base: Length; compact?: Length; wide?: Length };

export const allEdges = (length: Length) => ({
	blockEnd: length,
	blockStart: length,
	inlineEnd: length,
	inlineStart: length,
});

export const blockEdges = (block: Length) => ({ blockEnd: block, blockStart: block });

export const sectionBox = ({
	children,
	fill = "canvas",
	layout,
}: {
	children: Array<Node>;
	fill?: Fill;
	layout?: Layout;
}): Node => ({
	...(layout && { layout }),
	props: { children, fill },
	type: "box",
});

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
	radius?: "theme" | "none";
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
	children,
	columns,
	fill,
	gap,
	layout,
	radius,
}: {
	align?: Responsive<CrossAlign>;
	children: Array<Node>;
	columns: Responsive<number | Array<{ fraction: number } | Length>>;
	fill?: Fill;
	gap?: Responsive<Length>;
	layout?: Layout;
	radius?: "theme" | "none";
}): Node => ({
	...(layout && { layout }),
	props: {
		children,
		columns,
		...(align && { align }),
		...(fill && { fill }),
		...(gap !== undefined && { gap }),
		...(radius && { radius }),
	},
	type: "grid",
});

const frameEdges = (block: Length) => ({ ...blockEdges(block), inlineEnd: "1.5rem", inlineStart: "1.5rem" });

const framePadding = (padding: BlockPadding = { base: 0 }) => ({
	base: frameEdges(padding.base),
	...(padding.compact !== undefined && { compact: frameEdges(padding.compact) }),
	...(padding.wide !== undefined && { wide: frameEdges(padding.wide) }),
});

export const contentFrame = ({
	children,
	gap,
	layout,
	padding,
}: {
	children: Array<Node>;
	gap?: Responsive<Length>;
	layout?: Layout;
	padding?: BlockPadding;
}): Node =>
	flex({
		children,
		gap,
		layout: {
			inlineSize: "full",
			margin: { inlineEnd: "auto", inlineStart: "auto" },
			maxInlineSize: "96rem",
			padding: framePadding(padding),
			...layout,
		},
	});

export const text = ({
	align,
	appearance,
	element = "p",
	italic,
	layout,
	pointer,
	tone,
	wrap,
}: {
	align?: Align;
	appearance: TypographyAppearance;
	element?: "p" | "span" | "h1" | "h2" | "h3" | "h4";
	italic?: boolean;
	layout?: Layout;
	pointer: string;
	tone?: Foreground;
	wrap?: "balance" | "pretty";
}): Node => ({
	...(layout && { layout }),
	props: {
		appearance,
		content: { $text: pointer },
		element,
		font: element.startsWith("h") || appearance.startsWith("display") ? "brand" : "body",
		...(align && { align }),
		...(italic && { style: "italic" as const }),
		...(tone && { tone }),
		...(wrap && { wrap }),
	},
	type: "text",
});

export const kicker = ({
	pointer = "/copy/kicker",
	tone = "muted",
}: { pointer?: string; tone?: Foreground } = {}): Node => text({ appearance: "label-md", pointer, tone });

export const image = ({
	aspectRatio,
	blockSize,
	fill = "subtle",
	inlineSize,
	layout,
	overlay,
	pointer,
	radius = "theme",
}: {
	aspectRatio?: { height: number; width: number };
	blockSize?: Responsive<Length>;
	fill?: Fill;
	inlineSize?: Responsive<Length>;
	layout?: Layout;
	overlay?: MediaOverlay;
	pointer: string;
	radius?: "theme" | "none";
}): Node => ({
	layout: {
		...(aspectRatio && { aspectRatio }),
		...(blockSize !== undefined && { blockSize }),
		...(inlineSize !== undefined && { inlineSize }),
		...layout,
	},
	props: {
		alt: { $text: `${pointer}/alt` },
		assetId: { $asset: `${pointer}/assetId` },
		fill,
		fit: "cover",
		radius,
		...(overlay && { overlay }),
	},
	type: "media",
});

export const button = ({ index, outline = false }: { index: number; outline?: boolean }): Node => ({
	layout: {
		inlineSize: { base: "full", compact: "auto" },
		padding: { base: { ...blockEdges("2.5sp"), inlineEnd: "5sp", inlineStart: "5sp" } },
	},
	props: {
		children: [
			text({
				appearance: "body-sm-em",
				element: "span",
				pointer: `/actions/items/${index}/label`,
				tone: "current",
			}),
		],
		href: { $link: `/actions/items/${index}/link` },
		radius: "theme",
		...(outline
			? { border: { color: "current", width: 1 }, fill: "transparent" }
			: { fill: "action", foreground: "action" }),
	},
	type: "action",
});

export const divider = ({ fill = "border" }: { fill?: "border" | "current" } = {}): Node => ({
	layout: { blockSize: 1, inlineSize: "full" },
	props: { children: [], decorative: true, fill },
	type: "box",
});
