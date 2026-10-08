import type { CSSProperties } from "react";

import { z } from "zod";

import {
	pixelLengthSchema,
	type Edges,
	type Layout,
	type Length,
	type Responsive,
	type TranslateLength,
} from "../document/structure-schema";

type Breakpoint = "base" | "compact" | "medium" | "wide";

const breakpoints: Array<Breakpoint> = ["base", "compact", "medium", "wide"];

const stringSchema = z.compile(z.string());

const spacingLengthSchema = z.compile(z.string().regex(/^-?(?:\d+|\d*\.\d+)sp$/u));

const responsivePropertyDefaults = {
	"aspect-ratio": "auto",
	"block-size": "auto",
	display: "var(--iw-default-display)",
	"flex-align": "stretch",
	"flex-direction": "column",
	"flex-gap": "0",
	"flex-justify": "start",
	"flex-wrap": "nowrap",
	"grid-align": "stretch",
	"grid-auto-flow": "row",
	"grid-column": "auto",
	"grid-column-gap": "0",
	"grid-columns": "minmax(0, 1fr)",
	"grid-gap": "0",
	"grid-justify": "stretch",
	"grid-row": "auto",
	"grid-row-gap": "0",
	"grid-rows": "none",
	"icon-size": "1rem",
	"inline-size": "auto",
	"inset-block-end": "auto",
	"inset-block-start": "auto",
	"inset-inline-end": "auto",
	"inset-inline-start": "auto",
	"margin-block-end": "0",
	"margin-block-start": "0",
	"margin-inline-end": "0",
	"margin-inline-start": "0",
	"max-block-size": "none",
	"max-inline-size": "none",
	"min-block-size": "auto",
	"min-inline-size": "auto",
	order: "0",
	overflow: "visible",
	"padding-block-end": "0",
	"padding-block-start": "0",
	"padding-inline-end": "0",
	"padding-inline-start": "0",
	position: "static",
	"slide-basis": "100%",
	"slide-gap": "0",
	"text-size": "1rem",
	"translate-block": "0px",
	"translate-inline": "0px",
	"translate-inline-rtl": "0px",
	visibility: "visible",
};

export const isResponsiveObject = <T>(
	value: Responsive<T>
): value is { base: T; compact?: T; medium?: T; wide?: T } => {
	return z
		.strictObject({
			base: z.custom<T>(),
			compact: z.custom<T>().optional(),
			medium: z.custom<T>().optional(),
			wide: z.custom<T>().optional(),
		})
		.safeParse(value).success;
};

export const lengthToCss = (value: Length) => {
	const pixels = pixelLengthSchema.safeParse(value);

	if (pixels.success) {
		return `${pixels.data}px`;
	}

	if (value === "0") {
		return "0px";
	}

	if (value === "full") {
		return "100%";
	}

	const spacing = spacingLengthSchema.safeParse(value);

	if (spacing.success) {
		return `calc(var(--iw-spacing) * ${spacing.data.slice(0, -2)})`;
	}

	if (value === "viewport") {
		return "100svh";
	}

	if (value === "viewport-minus-gutter") {
		return "calc(100cqw - 3rem)";
	}

	if (value === "bleed-offset") {
		return "calc((100% - (100cqw - 3rem)) / 2)";
	}

	if (value === "viewport-bleed-offset") {
		return "calc((100% - 100cqw) / 2)";
	}

	return String(value);
};

export const paddingStyle = (padding?: Edges<Length>) => ({
	paddingBlockEnd: padding?.blockEnd === undefined ? undefined : lengthToCss(padding.blockEnd),
	paddingBlockStart: padding?.blockStart === undefined ? undefined : lengthToCss(padding.blockStart),
	paddingInlineEnd: padding?.inlineEnd === undefined ? undefined : lengthToCss(padding.inlineEnd),
	paddingInlineStart: padding?.inlineStart === undefined ? undefined : lengthToCss(padding.inlineStart),
});

const mirroredTranslateToCss = (value: TranslateLength) => {
	const pixels = pixelLengthSchema.safeParse(value);

	if (pixels.success) {
		return `${pixels.data === 0 ? 0 : -pixels.data}px`;
	}

	const unitLength = stringSchema.parse(value);

	if (unitLength.startsWith("-")) {
		return unitLength.slice(1);
	}

	return `-${unitLength}`;
};

export const setResponsiveValue = <T>({
	name,
	serialize,
	style,
	value,
}: {
	name: string;
	serialize: (value: T) => string | number;
	style: CSSProperties;
	value?: Responsive<T>;
}) => {
	if (value === undefined) {
		return;
	}

	const assign = (breakpoint: Breakpoint, breakpointValue: T | undefined) => {
		if (breakpointValue === undefined) {
			return;
		}

		style[`--iw-${name}-${breakpoint}`] = serialize(breakpointValue);
	};

	if (isResponsiveObject(value)) {
		const compact = value.compact ?? value.base;
		const medium = value.medium ?? compact;
		assign("base", value.base);
		assign("compact", compact);
		assign("medium", medium);
		assign("wide", value.wide ?? medium);

		return;
	}

	breakpoints.forEach((breakpoint) => assign(breakpoint, value));
};

const setResponsiveEdges = ({
	name,
	style,
	value,
}: {
	name: "inset" | "margin" | "padding";
	style: CSSProperties;
	value?: Responsive<Edges<Length>>;
}) => {
	if (value === undefined) {
		return;
	}

	const assignEdges = (breakpoint: Breakpoint, edges: Edges<Length> | undefined) => {
		if (!edges) {
			return;
		}

		if (edges.blockStart !== undefined) {
			style[`--iw-${name}-block-start-${breakpoint}`] = lengthToCss(edges.blockStart);
		}

		if (edges.inlineEnd !== undefined) {
			style[`--iw-${name}-inline-end-${breakpoint}`] = lengthToCss(edges.inlineEnd);
		}

		if (edges.blockEnd !== undefined) {
			style[`--iw-${name}-block-end-${breakpoint}`] = lengthToCss(edges.blockEnd);
		}

		if (edges.inlineStart !== undefined) {
			style[`--iw-${name}-inline-start-${breakpoint}`] = lengthToCss(edges.inlineStart);
		}
	};

	if (isResponsiveObject(value)) {
		const compact = { ...value.base, ...value.compact };
		const medium = { ...compact, ...value.medium };
		assignEdges("base", value.base);
		assignEdges("compact", compact);
		assignEdges("medium", medium);
		assignEdges("wide", { ...medium, ...value.wide });

		return;
	}

	breakpoints.forEach((breakpoint) => assignEdges(breakpoint, value));
};

const visibilityDisplay = (value: "visible" | "hidden" | "removed") => {
	return value === "removed" ? "none" : "var(--iw-default-display)";
};

const visibilityValue = (value: "visible" | "hidden" | "removed") => {
	return value === "visible" ? "visible" : "hidden";
};

export const layoutStyle = (layout?: Layout) => {
	const style: CSSProperties = {};

	Object.entries(responsivePropertyDefaults).forEach(([name, defaultValue]) => {
		breakpoints.forEach((breakpoint) => {
			style[`--iw-${name}-${breakpoint}`] = defaultValue;
		});
	});

	if (!layout) {
		return style;
	}

	setResponsiveValue({ name: "inline-size", serialize: lengthToCss, style, value: layout.inlineSize });
	setResponsiveValue({ name: "block-size", serialize: lengthToCss, style, value: layout.blockSize });
	setResponsiveValue({ name: "min-inline-size", serialize: lengthToCss, style, value: layout.minInlineSize });
	setResponsiveValue({ name: "max-inline-size", serialize: lengthToCss, style, value: layout.maxInlineSize });
	setResponsiveValue({ name: "min-block-size", serialize: lengthToCss, style, value: layout.minBlockSize });
	setResponsiveValue({ name: "max-block-size", serialize: lengthToCss, style, value: layout.maxBlockSize });
	setResponsiveValue({ name: "position", serialize: String, style, value: layout.position });
	setResponsiveValue({ name: "overflow", serialize: String, style, value: layout.overflow });

	setResponsiveValue({
		name: "aspect-ratio",
		serialize: (value) => (value === "auto" ? "auto" : `${value.width} / ${value.height}`),
		style,
		value: layout.aspectRatio,
	});

	setResponsiveValue({
		name: "grid-column",
		serialize: (value) => `${value.start} / span ${value.span}`,
		style,
		value: layout.gridColumn,
	});

	setResponsiveValue({
		name: "grid-row",
		serialize: (value) => `${value.start} / span ${value.span}`,
		style,
		value: layout.gridRow,
	});

	setResponsiveValue({ name: "order", serialize: String, style, value: layout.order });

	setResponsiveValue({
		name: "translate-inline",
		serialize: (value) => (value.inline === undefined ? "0px" : lengthToCss(value.inline)),
		style,
		value: layout.translate,
	});

	setResponsiveValue({
		name: "translate-inline-rtl",
		serialize: (value) => (value.inline === undefined ? "0px" : mirroredTranslateToCss(value.inline)),
		style,
		value: layout.translate,
	});

	setResponsiveValue({
		name: "translate-block",
		serialize: (value) => (value.block === undefined ? "0px" : lengthToCss(value.block)),
		style,
		value: layout.translate,
	});

	setResponsiveValue({ name: "display", serialize: visibilityDisplay, style, value: layout.visibility });
	setResponsiveValue({ name: "visibility", serialize: visibilityValue, style, value: layout.visibility });
	setResponsiveEdges({ name: "padding", style, value: layout.padding });
	setResponsiveEdges({ name: "margin", style, value: layout.margin });
	setResponsiveEdges({ name: "inset", style, value: layout.inset });

	style.flexGrow = layout.grow;
	style.flexShrink = layout.shrink;
	style.zIndex = layout.zIndex;

	return style;
};
