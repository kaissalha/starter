import type {
	Foreground,
	Layout,
	Responsive,
	SiteNodeDefinition,
	TypographyAppearance,
} from "../../../document/structure-schema";
import type { SectionRepeater } from "../../section-definition";

type Block = [start: string, end: string];

export const bannerPadding = ({
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
	const edges = ([start, end]: Block) => {
		return { blockEnd: end, blockStart: start, inlineEnd: inline, inlineStart: inline };
	};

	return {
		base: edges(base),
		...(compact && { compact: edges(compact) }),
		...(wide && { wide: edges(wide) }),
	} satisfies Layout["padding"];
};

export const bannerContentLayout = {
	inlineSize: "full",
	margin: { inlineEnd: "auto", inlineStart: "auto" },
	maxInlineSize: "96rem",
} satisfies Layout;

export const bannerTextNode = ({
	align = "start",
	appearance,
	element = "p",
	layout,
	pointer,
	tone = "primary",
	wrap,
}: {
	align?: Responsive<"center" | "end" | "start">;
	appearance: TypographyAppearance;
	element?: "h1" | "h2" | "h3" | "p" | "span";
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

export const bannerKicker = ({
	align = "start",
	layout,
	tone = "muted",
}: {
	align?: Responsive<"center" | "start">;
	layout?: Layout;
	tone?: Foreground;
}) => {
	return {
		layout: { blockSize: "1.5rem", ...layout },
		props: {
			align: "center",
			children: [
				bannerTextNode({ align, appearance: "label-md", element: "span", pointer: "/copy/kicker", tone }),
			],
			direction: "row",
			justify: align,
		},
		type: "flex",
	} satisfies SiteNodeDefinition;
};

export type BannerButtonAppearance = "outline" | "primary" | "secondary";

const buttonAppearance = {
	outline: { border: { color: "current", width: "1px" }, fill: "transparent" },
	primary: { fill: "action", foreground: "action" },
	secondary: { fill: "subtle", foreground: "primary" },
} as const;

export const bannerAction = ({
	appearance,
	index,
	layout,
	onMedia = false,
}: {
	appearance: BannerButtonAppearance;
	index: number;
	layout?: Layout;
	onMedia?: boolean;
}) => {
	return {
		layout: {
			padding: { blockEnd: "2.5sp", blockStart: "2.5sp", inlineEnd: "5sp", inlineStart: "5sp" },
			...layout,
		},
		props: {
			...buttonAppearance[appearance],
			...(onMedia && appearance === "outline" && { foreground: "media" as const }),
			children: [
				bannerTextNode({
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

export const bannerButtonRow = ({
	justify = "start",
	layout,
}: {
	justify?: "center" | "end" | "start";
	layout?: Layout;
}) => {
	return {
		...(layout && { layout }),
		props: {
			align: "stretch",
			children: [],
			direction: { base: "column", compact: "row" },
			gap: "4sp",
			justify: { base: "start", compact: justify },
			wrap: "wrap",
		},
		type: "flex",
	} satisfies SiteNodeDefinition;
};

export const bannerActionsRepeater = ({
	appearances,
	initial = appearances.length,
	onMedia,
	target,
}: {
	appearances: Array<BannerButtonAppearance>;
	initial?: number;
	onMedia?: boolean;
	target: string;
}) => {
	return {
		collection: "/actions",
		createValues: ({ index }) => [
			bannerAction({
				appearance: appearances[index] ?? "secondary",
				index,
				layout: { inlineSize: { base: "full", compact: "auto" } },
				onMedia,
			}),
		],
		initial,
		max: appearances.length,
		min: 1,
		target,
	} satisfies SectionRepeater;
};

export const bannerDivider = ({ tone = "muted" }: { tone?: Foreground }) => {
	return {
		layout: { blockSize: "1px", inlineSize: "full" },
		props: { children: [], decorative: true, fill: "current", foreground: tone },
		type: "box",
	} satisfies SiteNodeDefinition;
};
