import type {
	Edges,
	Foreground,
	Layout,
	Length,
	Responsive,
	SiteNodeDefinition,
	TypographyAppearance,
} from "../../../document/structure-schema";

type NodeProps<TType extends SiteNodeDefinition["type"]> = Extract<SiteNodeDefinition, { type: TType }>["props"];

type WithLayout<TProps> = TProps & { layout?: Layout };

export const box = ({ layout, ...props }: WithLayout<NodeProps<"box">>) =>
	({ layout, props, type: "box" }) satisfies SiteNodeDefinition;

export const flex = ({ layout, ...props }: WithLayout<NodeProps<"flex">>) =>
	({ layout, props, type: "flex" }) satisfies SiteNodeDefinition;

export const grid = ({ layout, ...props }: WithLayout<NodeProps<"grid">>) =>
	({ layout, props, type: "grid" }) satisfies SiteNodeDefinition;

export const media = ({ layout, ...props }: WithLayout<NodeProps<"media">>) =>
	({ layout, props, type: "media" }) satisfies SiteNodeDefinition;

export const text = ({
	appearance,
	element = "p",
	font,
	layout,
	pointer,
	tone = "primary",
	...props
}: Omit<NodeProps<"text">, "appearance" | "content" | "element" | "font" | "tone"> & {
	appearance: TypographyAppearance;
	element?: NodeProps<"text">["element"];
	font?: NodeProps<"text">["font"];
	layout?: Layout;
	pointer: string;
	tone?: Foreground;
}) =>
	({
		layout,
		props: {
			...props,
			appearance,
			content: { $text: pointer },
			element,
			font: font ?? (element.startsWith("h") || appearance.startsWith("display") ? "brand" : "body"),
			tone,
		},
		type: "text",
	}) satisfies SiteNodeDefinition;

export const itemMedia = ({
	collection,
	index,
	layout,
	...props
}: Omit<NodeProps<"media">, "alt" | "assetId"> & { collection: string; index: number; layout?: Layout }) =>
	media({
		...props,
		alt: { $text: `/${collection}/items/${index}/alt` },
		assetId: { $asset: `/${collection}/items/${index}/assetId` },
		fill: "subtle",
		fit: "cover",
		layout,
		radius: "theme",
	});

export const kicker = ({ pointer, tone = "muted" }: { pointer: string; tone?: Foreground }) =>
	text({ appearance: "label-md", pointer, tone });

export const divider = ({ layout }: { layout?: Layout } = {}) =>
	box({ children: [], decorative: true, fill: "border", layout: { blockSize: 1, inlineSize: "full", ...layout } });

type ButtonVariant = "outline" | "primary" | "secondary";

const buttonAppearance = {
	outline: { border: { color: "current", width: "1px" }, fill: "transparent" },
	primary: { fill: "action", foreground: "action" },
	secondary: { fill: "subtle", foreground: "primary" },
} satisfies Record<ButtonVariant, Partial<NodeProps<"action">>>;

export const button = ({
	index,
	layout,
	variant = "primary",
}: {
	index: number;
	layout?: Layout;
	variant?: ButtonVariant;
}) =>
	({
		layout: {
			inlineSize: { base: "full", compact: "fit-content" },
			padding: { blockEnd: "2.5sp", blockStart: "2.5sp", inlineEnd: "5sp", inlineStart: "5sp" },
			...layout,
		},
		props: {
			...buttonAppearance[variant],
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
		},
		type: "action",
	}) satisfies SiteNodeDefinition;

export const buttonGroup = ({ variants }: { variants: Array<ButtonVariant> }) =>
	flex({
		children: variants.map((variant, index) => button({ index, variant })),
		direction: { base: "column", compact: "row" },
		gap: "4sp",
	});

type BlockPadding = Pick<Edges<Length>, "blockEnd" | "blockStart">;

export const sectionContent = ({
	children,
	direction = "column",
	gap,
	justify,
	layout,
	padding,
}: {
	children: Array<SiteNodeDefinition>;
	direction?: Responsive<"column" | "row">;
	gap?: Responsive<Length>;
	justify?: NodeProps<"flex">["justify"];
	layout?: Layout;
	padding: { base: BlockPadding; compact?: BlockPadding; wide?: BlockPadding };
}) => {
	const inline = { inlineEnd: "1.5rem", inlineStart: "1.5rem" };

	return flex({
		children,
		direction,
		gap,
		justify,
		layout: {
			inlineSize: "full",
			margin: { inlineEnd: "auto", inlineStart: "auto" },
			maxInlineSize: "96rem",
			padding: {
				base: { ...inline, ...padding.base },
				compact: padding.compact && { ...inline, ...padding.compact },
				wide: padding.wide && { ...inline, ...padding.wide },
			},
			position: "relative",
			...layout,
		},
	});
};

export const sectionShell = ({
	after,
	background,
	children,
	fill = "canvas",
	rootLayout,
	...content
}: {
	after?: Array<SiteNodeDefinition>;
	background?: Array<SiteNodeDefinition>;
	children: Array<SiteNodeDefinition>;
	fill?: NodeProps<"box">["fill"];
	gap?: Responsive<Length>;
	padding: { base: BlockPadding; compact?: BlockPadding; wide?: BlockPadding };
	rootLayout?: Layout;
}) =>
	box({
		children: [...(background ?? []), sectionContent({ children, ...content }), ...(after ?? [])],
		fill,
		layout: rootLayout,
	});

export const masonry = ({ layout, ...props }: WithLayout<NodeProps<"masonry">>) =>
	({ layout, props, type: "masonry" }) satisfies SiteNodeDefinition;

export const symmetric = ({ value }: { value: Length }): BlockPadding => ({ blockEnd: value, blockStart: value });
