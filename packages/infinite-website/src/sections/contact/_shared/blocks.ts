import { z } from "zod";

import type { Foreground, Layout, SiteNodeDefinition, TextAppearance } from "../../../document/structure-schema";

export type Node = SiteNodeDefinition;

type Definition<TType extends Node["type"]> = Extract<Node, { type: TType }>;

type ContainerProps<TType extends "box" | "flex" | "grid"> = Omit<Definition<TType>["props"], "children"> & {
	children: Array<Node>;
	layout?: Layout;
};

export const box = ({ children, layout, ...props }: ContainerProps<"box">): Node => ({
	...(layout && { layout }),
	props: { ...props, children },
	type: "box",
});

export const flex = ({ children, layout, ...props }: ContainerProps<"flex">): Node => ({
	...(layout && { layout }),
	props: { ...props, children },
	type: "flex",
});

export const grid = ({ children, layout, ...props }: ContainerProps<"grid">): Node => ({
	...(layout && { layout }),
	props: { ...props, children },
	type: "grid",
});

export const text = ({
	align,
	appearance,
	element = "p",
	layout,
	pointer,
	tone = "primary",
	wrap,
}: {
	align?: TextAppearance["align"];
	appearance: NonNullable<TextAppearance["appearance"]>;
	element?: "h1" | "h2" | "h3" | "p" | "span";
	layout?: Layout;
	pointer: string;
	tone?: Foreground;
	wrap?: TextAppearance["wrap"];
}): Node => ({
	...(layout && { layout }),
	props: {
		...(align && { align }),
		appearance,
		content: { $text: pointer },
		element,
		font: element.startsWith("h") ? "brand" : "body",
		tone,
		...(wrap && { wrap }),
	},
	type: "text",
});

export const kicker = ({
	align,
	pointer = "/copy/kicker",
}: { align?: TextAppearance["align"]; pointer?: string } = {}) =>
	text({ align, appearance: "label-md", pointer, tone: "muted" });

export const heading = ({
	align,
	appearance = "display-sm",
	layout,
	pointer = "/copy/heading",
}: {
	align?: TextAppearance["align"];
	appearance?: NonNullable<TextAppearance["appearance"]>;
	layout?: Layout;
	pointer?: string;
}) => text({ align, appearance, element: "h2", layout, pointer, wrap: "balance" });

export const description = ({
	align,
	appearance = "body-md",
	layout,
	pointer = "/copy/description",
}: {
	align?: TextAppearance["align"];
	appearance?: NonNullable<TextAppearance["appearance"]>;
	layout?: Layout;
	pointer?: string;
}) => text({ align, appearance, layout, pointer, tone: "muted" });

export const sectionRoot = ({ children, layout }: { children: Array<Node>; layout?: Layout }) =>
	box({ children, fill: "canvas", ...(layout && { layout }) });

type Units = number | { base: number; compact?: number; wide?: number };

type EdgeUnits = { blockEnd?: Units; blockStart?: Units; inlineEnd?: Units; inlineStart?: Units };

type Step = "base" | "compact" | "wide";

const sp = (units: number) => (units === 0 ? 0 : `${units}sp`);

const numberSchema = z.number();

const specSchema = z.object({ base: z.number(), compact: z.number().optional(), wide: z.number().optional() });

const normalize = (units: Units) => {
	const scalar = numberSchema.safeParse(units);

	if (scalar.success) {
		return { base: scalar.data, compact: scalar.data, wide: scalar.data };
	}

	const spec = specSchema.parse(units);
	const compact = spec.compact ?? spec.base;

	return { base: spec.base, compact, wide: spec.wide ?? compact };
};

const unitsAt = ({ step, units }: { step: Step; units: Units }) => sp(normalize(units)[step]);

export const space = (units: Units) => {
	const scalar = numberSchema.safeParse(units);

	return scalar.success
		? sp(scalar.data)
		: {
				base: unitsAt({ step: "base", units }),
				compact: unitsAt({ step: "compact", units }),
				wide: unitsAt({ step: "wide", units }),
			};
};

export const spaceEdges = (edges: EdgeUnits) => {
	const at = (step: Step) =>
		Object.fromEntries(
			Object.entries(edges).flatMap(([edge, units]) =>
				units === undefined ? [] : [[edge, unitsAt({ step, units })]]
			)
		);

	return { base: at("base"), compact: at("compact"), wide: at("wide") };
};

export const contentLayout = ({ block = { base: 16, compact: 20 } }: { block?: Units } = {}): Layout => ({
	inlineSize: "full",
	margin: { inlineEnd: "auto", inlineStart: "auto" },
	maxInlineSize: "96rem",
	padding: Object.fromEntries(
		Object.entries(spaceEdges({ blockEnd: block, blockStart: block })).map(([step, edges]) => [
			step,
			{ ...edges, inlineEnd: "1.5rem", inlineStart: "1.5rem" },
		])
	),
});

export const divider = ({ layout }: { layout?: Layout } = {}) =>
	box({ children: [], fill: "border", layout: { blockSize: "1px", inlineSize: "full", ...layout } });

export const contactForm = ({
	columns = 1,
	layout,
	submitWidth = "fit",
	...appearance
}: Omit<Extract<Definition<"embed">["props"], { provider: "contact-form" }>, "config" | "label" | "provider"> & {
	columns?: 1 | 2;
	layout?: Layout;
	submitWidth?: "fit" | "full";
}): Node => ({
	...(layout && { layout }),
	props: {
		...appearance,
		config: {
			columns,
			labels: {
				anotherLabel: { $text: "/form/anotherLabel" },
				emailLabel: { $text: "/form/emailLabel" },
				error: { $text: "/form/error" },
				messageLabel: { $text: "/form/messageLabel" },
				nameLabel: { $text: "/form/nameLabel" },
				pendingLabel: { $text: "/form/pendingLabel" },
				submitLabel: { $text: "/form/submitLabel" },
				success: { $text: "/form/success" },
			},
			submitWidth,
		},
		label: { $text: "/copy/heading" },
		provider: "contact-form",
	},
	type: "embed",
});

export const media = ({
	index = 0,
	layout,
	...appearance
}: Omit<Extract<Definition<"media">["props"], object>, "alt" | "assetId"> & {
	index?: number;
	layout?: Layout;
}): Node => ({
	...(layout && { layout }),
	props: {
		...appearance,
		alt: { $text: `/media/items/${index}/alt` },
		assetId: { $asset: `/media/items/${index}/assetId` },
		fill: "subtle",
		fit: "cover",
	},
	type: "media",
});

export const backgroundMedia = () =>
	media({
		layout: {
			blockSize: "full",
			inlineSize: "full",
			inset: { blockEnd: 0, blockStart: 0, inlineEnd: 0, inlineStart: 0 },
			position: "absolute",
		},
		radius: "none",
	});

export const formIntro = ({
	descriptionAppearance,
	layout,
}: { descriptionAppearance?: "body-lg" | "body-md"; layout?: Layout } = {}) =>
	flex({
		children: [
			flex({
				children: [
					kicker(),
					flex({
						children: [heading({}), description({ appearance: descriptionAppearance })],
						direction: "column",
						gap: space(6),
					}),
				],
				direction: "column",
				gap: space(4),
			}),
		],
		direction: "column",
		...(layout && { layout }),
	});

export const linkAction = ({
	appearance = "body-md",
	index,
	underline = true,
}: {
	appearance?: "body-md" | "body-sm";
	index: number;
	underline?: boolean;
}): Node => ({
	props: {
		children: [
			{
				props: {
					appearance,
					content: { $text: `/actions/items/${index}/label` },
					...(underline && { decoration: "underline" as const }),
					element: "span",
					font: "body",
					tone: "current",
				},
				type: "text",
			},
		],
		fill: "transparent",
		foreground: "primary",
		href: { $link: `/actions/items/${index}/link` },
	},
	type: "action",
});

export const iconItem = ({
	align = "start",
	children,
	icon,
	iconSize = 5,
	pill = "tint",
}: {
	align?: "center" | "start" | { base: "center" | "start"; compact: "center" | "start" };
	children: Array<Node>;
	icon: "email" | "location-pin" | "phone";
	iconSize?: number;
	pill?: "subtle" | "tint";
}) =>
	flex({
		align,
		children: [
			box({
				children: [
					{ props: { filled: true, name: icon, size: space(iconSize), tone: "primary" }, type: "icon" },
				],
				fill: pill,
				layout: {
					inlineSize: "fit-content",
					padding: spaceEdges({ blockEnd: 1, blockStart: 1, inlineEnd: 1, inlineStart: 1 }),
				},
				radius: "full",
			}),
			...children,
		],
		direction: "column",
		gap: space(2),
	});

export const mapEmbed = ({
	layout,
	radius = "none",
	tinted = true,
}: {
	layout?: Layout;
	radius?: "none" | "theme";
	tinted?: boolean;
}): Node => ({
	...(layout && { layout }),
	props: {
		config: {
			address: { $text: "/location/address" },
			mapType: { $setting: "/map/type" },
			zoom: { $setting: "/map/zoom" },
		},
		...(tinted && { effect: { intensity: 0.2, kind: "tint" } }),
		fill: "subtle",
		label: { $text: "/accessibility/mapLabel" },
		provider: "google-map",
		radius,
	},
	type: "embed",
});

export const iconText = ({
	appearance = "body-sm",
	icon,
	pointer,
}: {
	appearance?: "body-md" | "body-sm";
	icon: "email" | "location-pin" | "phone";
	pointer: string;
}) =>
	flex({
		align: "center",
		children: [
			{ props: { filled: true, name: icon, size: space(5), tone: "primary" }, type: "icon" },
			text({ appearance, element: "span", pointer }),
		],
		direction: "row",
		gap: space(2),
	});

export const button = ({ index, variant }: { index: number; variant: "outline" | "primary" | "secondary" }): Node => ({
	layout: { padding: spaceEdges({ blockEnd: 2.5, blockStart: 2.5, inlineEnd: 5, inlineStart: 5 }) },
	props: {
		...(variant === "outline" && { border: { color: "current", width: "1px" }, fill: "transparent" }),
		...(variant === "primary" && { fill: "action", foreground: "action" }),
		...(variant === "secondary" && { fill: "subtle", foreground: "primary" }),
		children: [
			{
				props: {
					appearance: "body-sm-em",
					content: { $text: `/actions/items/${index}/label` },
					element: "span",
					font: "body",
					tone: "current",
				},
				type: "text",
			},
		],
		href: { $link: `/actions/items/${index}/link` },
		radius: "theme",
	},
	type: "action",
});
