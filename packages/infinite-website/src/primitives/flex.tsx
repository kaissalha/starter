import type { CSSProperties, ReactNode } from "react";

import { cn } from "cn";

import type { Layout } from "../document/structure-schema";
import { appearance } from "./appearance";
import { layoutStyle, lengthToCss, setResponsiveValue } from "./layout";
import type { NodeProps } from "./shared";

const alignmentValue = (value: "start" | "center" | "end" | "stretch") => {
	return value;
};

const justificationValue = (value: "start" | "center" | "end" | "between" | "around" | "evenly") => {
	if (value === "between") {
		return "space-between";
	}

	if (value === "around") {
		return "space-around";
	}

	if (value === "evenly") {
		return "space-evenly";
	}

	return value;
};

export const flexStyle = ({
	align,
	direction,
	gap,
	justify,
	layout,
	wrap,
}: Partial<Pick<NodeProps<"flex">, "align" | "direction" | "gap" | "justify" | "wrap">> & { layout?: Layout }) => {
	const style: CSSProperties = layoutStyle(layout);

	setResponsiveValue({ name: "flex-direction", serialize: String, style, value: direction });
	setResponsiveValue({ name: "flex-wrap", serialize: String, style, value: wrap });
	setResponsiveValue({ name: "flex-gap", serialize: lengthToCss, style, value: gap });
	setResponsiveValue({ name: "flex-align", serialize: alignmentValue, style, value: align });
	setResponsiveValue({ name: "flex-justify", serialize: justificationValue, style, value: justify });

	return style;
};

export const Flex = ({
	align,
	background,
	border,
	children,
	direction,
	fill,
	fillOpacity,
	foreground,
	gap,
	justify,
	layout,
	opacity,
	pattern,
	radius,
	wrap,
}: Omit<NodeProps<"flex">, "children"> & { children: ReactNode; layout?: Layout }) => {
	const style = flexStyle({ align, direction, gap, justify, layout, wrap });
	const visual = appearance({ background, border, fill, fillOpacity, foreground, opacity, pattern, radius });

	return (
		<div className={cn("iw-layout iw-flex [&>*]:min-w-0", visual.className)} style={{ ...style, ...visual.style }}>
			{children}
		</div>
	);
};
