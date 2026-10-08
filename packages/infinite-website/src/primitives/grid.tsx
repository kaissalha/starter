import type { CSSProperties, ReactNode } from "react";

import { cn } from "cn";
import { z } from "zod";

import { lengthSchema, type CrossAlignment, type GridTrack, type Layout } from "../document/structure-schema";
import { appearance } from "./appearance";
import { layoutStyle, lengthToCss, setResponsiveValue } from "./layout";
import type { NodeProps } from "./shared";

const fractionTrackSchema = z.compile(z.strictObject({ fraction: z.number() }));

const boundedTrackSchema = z.compile(
	z.strictObject({ max: z.union([lengthSchema, fractionTrackSchema]), min: lengthSchema })
);

const trackToCss = (track: GridTrack) => {
	const fractionTrack = fractionTrackSchema.safeParse(track);

	if (fractionTrack.success) {
		return `${fractionTrack.data.fraction}fr`;
	}

	const boundedTrack = boundedTrackSchema.safeParse(track);

	if (boundedTrack.success) {
		const maximumFraction = fractionTrackSchema.safeParse(boundedTrack.data.max);

		const max = maximumFraction.success
			? `${maximumFraction.data.fraction}fr`
			: lengthToCss(lengthSchema.parse(boundedTrack.data.max));

		return `minmax(${lengthToCss(boundedTrack.data.min)}, ${max})`;
	}

	return lengthToCss(lengthSchema.parse(track));
};

const tracksToCss = (tracks: number | Array<GridTrack>) => {
	if (Array.isArray(tracks)) {
		return tracks.map(trackToCss).join(" ");
	}

	return `repeat(${tracks}, minmax(0, 1fr))`;
};

const alignmentValue = (value: CrossAlignment) => {
	if (value === "start") {
		return "start";
	}

	if (value === "end") {
		return "end";
	}

	return value;
};

export const gridStyle = ({
	align,
	autoFlow,
	columnGap,
	columns,
	gap,
	justify,
	layout,
	rowGap,
	rows,
}: Pick<NodeProps<"grid">, "align" | "autoFlow" | "columnGap" | "columns" | "gap" | "justify" | "rowGap" | "rows"> & {
	layout?: Layout;
}) => {
	const style: CSSProperties = layoutStyle(layout);

	setResponsiveValue({ name: "grid-columns", serialize: tracksToCss, style, value: columns });
	setResponsiveValue({ name: "grid-rows", serialize: tracksToCss, style, value: rows });
	setResponsiveValue({ name: "grid-gap", serialize: lengthToCss, style, value: gap });
	setResponsiveValue({ name: "grid-column-gap", serialize: lengthToCss, style, value: columnGap ?? gap });
	setResponsiveValue({ name: "grid-row-gap", serialize: lengthToCss, style, value: rowGap ?? gap });
	setResponsiveValue({ name: "grid-align", serialize: alignmentValue, style, value: align });
	setResponsiveValue({ name: "grid-justify", serialize: alignmentValue, style, value: justify });
	setResponsiveValue({ name: "grid-auto-flow", serialize: String, style, value: autoFlow });

	return style;
};

export const Grid = ({
	align,
	autoFlow,
	background,
	border,
	children,
	columnGap,
	columns,
	fill,
	fillOpacity,
	foreground,
	gap,
	justify,
	layout,
	opacity,
	radius,
	rowGap,
	rows,
}: Omit<NodeProps<"grid">, "children"> & { children: ReactNode; layout?: Layout }) => {
	const style = gridStyle({ align, autoFlow, columnGap, columns, gap, justify, layout, rowGap, rows });
	const visual = appearance({ background, border, fill, fillOpacity, foreground, opacity, radius });

	return (
		<div className={cn("iw-layout iw-grid", visual.className)} style={{ ...style, ...visual.style }}>
			{children}
		</div>
	);
};
