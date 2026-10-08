import type {
	Alignment,
	Edges,
	Fill,
	Foreground,
	Layout,
	Length,
	Radius,
	Responsive,
	SiteNodeDefinition,
	TypographyAppearance,
} from "../../../document/structure-schema";

type Padding = Responsive<Edges<Length>>;

type ButtonVariant = "outline" | "primary" | "secondary";

export const pad = ({ block, inline = 0 }: { block: Length; inline?: Length }): Edges<Length> => ({
	blockEnd: block,
	blockStart: block,
	inlineEnd: inline,
	inlineStart: inline,
});

export const padSides = ({
	blockEnd = 0,
	blockStart = 0,
	inlineEnd = 0,
	inlineStart = 0,
}: Edges<Length>): Edges<Length> => ({ blockEnd, blockStart, inlineEnd, inlineStart });

export const sectionRoot = ({
	children,
	fill = "canvas",
	layout,
}: {
	children: Array<SiteNodeDefinition>;
	fill?: Fill;
	layout?: Layout;
}): SiteNodeDefinition => ({ layout, props: { children, fill }, type: "box" });

export const sectionContent = ({
	align,
	children,
	direction = "column",
	gap,
	padding,
}: {
	align?: Responsive<"center" | "end" | "start" | "stretch">;
	children: Array<SiteNodeDefinition>;
	direction?: Responsive<"column" | "row">;
	gap?: Responsive<Length>;
	padding: Padding;
}): SiteNodeDefinition => ({
	layout: {
		inlineSize: "full",
		margin: { inlineEnd: "auto", inlineStart: "auto" },
		maxInlineSize: "96rem",
		padding,
	},
	props: { align, children, direction, gap },
	type: "flex",
});

export const text = ({
	align = "start",
	appearance,
	element = "p",
	layout,
	pointer,
	tone = "primary",
	wrap,
}: {
	align?: Alignment;
	appearance: TypographyAppearance;
	element?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
	layout?: Layout;
	pointer: string;
	tone?: Foreground;
	wrap?: "balance" | "normal" | "pretty";
}): SiteNodeDefinition => ({
	layout,
	props: {
		align,
		appearance,
		content: { $text: pointer },
		element,
		font: element.startsWith("h") ? "brand" : undefined,
		tone,
		wrap,
	},
	type: "text",
});

export const kicker = ({ align, pointer = "/copy/kicker" }: { align?: Alignment; pointer?: string } = {}) =>
	text({ align, appearance: "label-md", pointer, tone: "muted" });

export const heading = ({
	align,
	appearance = "display-sm",
	layout,
	pointer = "/copy/heading",
}: {
	align?: Alignment;
	appearance?: TypographyAppearance;
	layout?: Layout;
	pointer?: string;
}) => text({ align, appearance, element: "h2", layout, pointer });

const buttonSurface = {
	outline: { fill: "transparent", foreground: undefined },
	primary: { fill: "action", foreground: "action" },
	secondary: { fill: "subtle", foreground: "primary" },
} as const satisfies Record<ButtonVariant, { fill: Fill; foreground: Foreground | undefined }>;

export const button = ({
	index = 0,
	layout,
	pointer = `/actions/items/${index}`,
	variant = "primary",
}: {
	index?: number;
	layout?: Layout;
	pointer?: string;
	variant?: ButtonVariant;
}): SiteNodeDefinition => ({
	layout: {
		inlineSize: { base: "full", compact: "auto" },
		padding: pad({ block: "2.5sp", inline: "5sp" }),
		...layout,
	},
	props: {
		border: { color: variant === "outline" ? "current" : "action", width: "1px" },
		children: [
			{
				props: {
					appearance: "body-sm-em",
					content: { $text: `${pointer}/label` },
					element: "span",
					tone: "current",
				},
				type: "text",
			},
		],
		fill: buttonSurface[variant].fill,
		foreground: buttonSurface[variant].foreground,
		href: { $link: `${pointer}/link` },
		radius: "theme",
	},
	type: "action",
});

export const buttonGroup = ({
	align,
	justify,
	layout,
	variants,
}: {
	align?: Responsive<"center" | "end" | "start" | "stretch">;
	justify?: Responsive<"center" | "end" | "start">;
	layout?: Layout;
	variants: Array<ButtonVariant>;
}): SiteNodeDefinition => ({
	layout,
	props: {
		align,
		children: variants.map((variant, index) => button({ index, variant })),
		direction: { base: "column", compact: "row" },
		gap: "4sp",
		justify,
	},
	type: "flex",
});

export const media = ({
	layout,
	pointer,
	radius = "theme",
}: {
	layout?: Layout;
	pointer: string;
	radius?: Radius;
}): SiteNodeDefinition => ({
	layout,
	props: {
		alt: { $text: `${pointer}/alt` },
		assetId: { $asset: `${pointer}/assetId` },
		fill: "subtle",
		fit: "cover",
		objectAlign: "center",
		radius,
	},
	type: "media",
});

export const splitIntro = ({
	buttons,
	buttonsLayout,
	descriptionPointer = "/copy/description",
	kickerPointer = "/copy/kicker",
}: {
	buttons: Array<ButtonVariant>;
	buttonsLayout?: Layout;
	descriptionPointer?: string;
	kickerPointer?: string;
}): SiteNodeDefinition => ({
	props: {
		children: [
			kicker({ pointer: kickerPointer }),
			{
				props: {
					children: [
						{
							layout: { inlineSize: { base: "full", wide: "50%" } },
							props: {
								children: [
									{
										layout: { maxInlineSize: "36rem" },
										props: { children: [heading({})], direction: "column" },
										type: "flex",
									},
								],
								direction: "column",
							},
							type: "flex",
						},
						{
							layout: { inlineSize: { base: "full", wide: "50%" } },
							props: {
								children: [
									text({ appearance: "body-md", pointer: descriptionPointer, tone: "muted" }),
									buttonGroup({ layout: buttonsLayout, variants: buttons }),
								],
								direction: "column",
								gap: "8sp",
							},
							type: "flex",
						},
					],
					direction: { base: "column", wide: "row" },
					gap: { base: "4sp", compact: "8sp" },
					justify: "between",
				},
				type: "flex",
			},
		],
		direction: "column",
		gap: "4sp",
	},
	type: "flex",
});
