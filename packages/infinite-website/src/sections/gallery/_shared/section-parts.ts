import type {
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
	children,
	direction = "column",
	fill,
	fillOpacity,
	gap,
	justify,
	layout,
	radius,
	wrap,
}: {
	align?: Responsive<CrossAlign>;
	children: Array<Node>;
	direction?: Responsive<"row" | "column">;
	fill?: Fill;
	fillOpacity?: Responsive<number>;
	gap?: Responsive<Length>;
	justify?: Responsive<Align | "between">;
	layout?: Layout;
	radius?: "theme" | "none";
	wrap?: Responsive<"nowrap" | "wrap">;
}): Node => ({
	...(layout && { layout }),
	props: {
		children,
		direction,
		...(align && { align }),
		...(fill && { fill }),
		...(fillOpacity !== undefined && { fillOpacity }),
		...(radius && { radius }),
		...(gap !== undefined && { gap }),
		...(justify && { justify }),
		...(wrap && { wrap }),
	},
	type: "flex",
});

export const grid = ({
	align,
	children,
	columnGap,
	columns,
	gap,
	layout,
	rows,
}: {
	align?: Responsive<CrossAlign>;
	children: Array<Node>;
	columnGap?: Responsive<Length>;
	columns: Responsive<number | Array<{ fraction: number } | Length>>;
	gap?: Responsive<Length>;
	layout?: Layout;
	rows?: Responsive<number | Array<{ fraction: number } | Length>>;
}): Node => ({
	...(layout && { layout }),
	props: {
		children,
		columns,
		...(align && { align }),
		...(columnGap !== undefined && { columnGap }),
		...(gap !== undefined && { gap }),
		...(rows !== undefined && { rows }),
	},
	type: "grid",
});

export const box = ({
	children = [],
	fill,
	layout,
	opacity,
	radius,
}: {
	children?: Array<Node>;
	fill?: Fill;
	layout?: Layout;
	opacity?: number;
	radius?: "theme" | "none";
}): Node => ({
	...(layout && { layout }),
	props: {
		children,
		...(fill && { fill }),
		...(opacity !== undefined && { opacity }),
		...(radius && { radius }),
	},
	type: "box",
});

export const blockPadding = ({ base, compact }: { base: Length; compact?: Length }) => ({
	base: { blockEnd: base, blockStart: base },
	...(compact !== undefined && { compact: { blockEnd: compact, blockStart: compact } }),
});

export const contentFrame = ({
	align,
	children,
	gap,
	inset = true,
	layout,
	padding,
}: {
	align?: Responsive<CrossAlign>;
	children: Array<Node>;
	gap?: Responsive<Length>;
	inset?: boolean;
	layout?: Layout;
	padding: { base: Length; compact?: Length };
}): Node => {
	const inline = inset ? { inlineEnd: "1.5rem", inlineStart: "1.5rem" } : {};
	const block = blockPadding(padding);

	return flex({
		align,
		children,
		gap,
		layout: {
			inlineSize: "full",
			margin: { inlineEnd: "auto", inlineStart: "auto" },
			maxInlineSize: "96rem",
			padding: {
				base: { ...block.base, ...inline },
				...(block.compact && { compact: { ...block.compact, ...inline } }),
			},
			...layout,
		},
	});
};

export const text = ({
	align,
	appearance,
	element = "p",
	layout,
	pointer,
	tone,
}: {
	align?: Align;
	appearance: TypographyAppearance;
	element?: "p" | "span" | "h1" | "h2" | "h3" | "h4";
	layout?: Layout;
	pointer: string;
	tone?: Foreground;
}): Node => ({
	...(layout && { layout }),
	props: {
		appearance,
		content: { $text: pointer },
		element,
		font: element.startsWith("h") || appearance.startsWith("display") ? "brand" : "body",
		...(align && { align }),
		...(tone && { tone }),
	},
	type: "text",
});

export const kicker = ({
	align,
	pointer = "/copy/kicker",
	tone = "muted",
}: { align?: Align; pointer?: string; tone?: Foreground } = {}): Node =>
	text({ align, appearance: "label-md", element: "span", pointer, tone });

export const media = ({
	aspectRatio,
	fill = "subtle",
	filter,
	fit = "cover",
	hoverOpacity,
	imageOpacity,
	layout,
	objectAlign = "center",
	overlay,
	pointer,
	radius = "theme",
}: {
	aspectRatio?: { height: number; width: number };
	fill?: Fill;
	filter?: "grayscale" | "silhouette" | "silhouette-light";
	fit?: "contain" | "cover";
	hoverOpacity?: number;
	imageOpacity?: number;
	layout?: Layout;
	objectAlign?: Align;
	overlay?: MediaOverlay;
	pointer: string;
	radius?: "theme" | "none";
}): Node => ({
	layout: { ...(aspectRatio && { aspectRatio }), ...layout },
	props: {
		alt: { $text: `${pointer}/alt` },
		assetId: { $asset: `${pointer}/assetId` },
		fill,
		fit,
		...(filter && { filter }),
		...(hoverOpacity !== undefined && { hoverOpacity }),
		...(imageOpacity !== undefined && { imageOpacity }),
		objectAlign,
		radius,
		...(overlay && { overlay }),
	},
	type: "media",
});

export const mediaAt = ({ index, ...options }: Omit<Parameters<typeof media>[0], "pointer"> & { index: number }) =>
	media({ ...options, pointer: `/media/items/${index}` });

const button = ({ index }: { index: number }): Node => ({
	layout: {
		inlineSize: { base: "full", compact: "auto" },
		padding: { blockEnd: "2.5sp", blockStart: "2.5sp", inlineEnd: "5sp", inlineStart: "5sp" },
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
		...(index === 0 ? { fill: "action", foreground: "action" } : { fill: "subtle", foreground: "primary" }),
	},
	type: "action",
});

export const buttons = ({ align = "center", count = 1 }: { align?: Align; count?: number } = {}): Node =>
	flex({
		align: { base: "stretch", compact: "center" },
		children: Array.from({ length: count }, (_, index) => button({ index })),
		direction: { base: "column", compact: "row" },
		gap: "4sp",
		justify: { base: "start", compact: align },
	});

export const absoluteFill: Layout = {
	inset: { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 },
	position: "absolute",
};

export const imageCells = ({ count, place }: { count: number; place: (index: number) => Layout }): Array<Node> =>
	Array.from({ length: count }, (_, index) => mediaAt({ index, layout: place(index) }));
