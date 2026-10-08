import type { CSSProperties, ReactNode } from "react";

import { Button as BaseButton } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "cn";

import type { Layout } from "../document/structure-schema";
import { appearance } from "./appearance";
import { layoutStyle, lengthToCss, setResponsiveValue } from "./layout";
import type { NodeProps, SiteLinkComponent, SiteLinkElementProps } from "./shared";

const actionVariants = cva("inline-flex min-w-0 max-w-full items-center justify-center", {
	defaultVariants: { font: "body" },
	variants: {
		font: { body: "font-body", brand: "font-brand", mono: "font-mono" },
		weight: {
			bold: "font-bold",
			light: "font-light",
			medium: "font-medium",
			normal: "font-normal",
			semibold: "font-semibold",
			theme: "[font-weight:var(--website-heading-weight)]",
		},
	},
});

export const Action = ({
	align,
	background,
	border,
	children,
	decoration,
	fill,
	fillOpacity,
	font,
	fontSize,
	foreground,
	href,
	layout,
	lineHeight,
	linkComponent: LinkComponent = "a",
	linkElementProps,
	opacity,
	radius,
	style: fontStyle,
	tracking,
	transform,
	weight,
}: Omit<NodeProps<"action">, "children"> & {
	children: ReactNode;
	layout?: Layout;
	linkComponent?: SiteLinkComponent;
	linkElementProps?: SiteLinkElementProps;
}) => {
	const brandButton = fill === "action";

	const visual = appearance({
		background,
		border,
		fill: brandButton ? undefined : fill,
		fillOpacity,
		foreground: brandButton ? undefined : foreground,
		opacity,
		radius,
		radiusRole: "control",
	});

	const actionStyle: CSSProperties = {
		...layoutStyle(layout),
		...visual.style,
		"--iw-default-display": "inline-flex",
	};

	setResponsiveValue({ name: "text-size", serialize: lengthToCss, style: actionStyle, value: fontSize });
	setResponsiveValue({ name: "text-align", serialize: String, style: actionStyle, value: align });
	actionStyle["--iw-default-text-align"] = "center";
	actionStyle.lineHeight = lineHeight;
	actionStyle.fontWeight = 500;
	const fontRole = font === "brand" ? "heading" : "body";
	actionStyle.fontStyle = fontStyle ?? (font !== "mono" ? `var(--website-${fontRole}-style)` : undefined);
	actionStyle.fontVariationSettings = font !== "mono" ? `var(--website-${fontRole}-axes)` : undefined;
	actionStyle.textTransform = transform;
	actionStyle.textDecoration = decoration;
	actionStyle.letterSpacing = tracking === undefined ? undefined : lengthToCss(tracking);
	actionStyle.overflowWrap = "anywhere";

	return (
		<BaseButton
			className={cn(
				"iw-layout iw-text",
				actionVariants({ font, weight }),
				layout?.inlineSize === undefined && "w-fit",
				visual.className,
				brandButton &&
					"bg-[var(--website-button-fill)] text-[var(--website-button-foreground)] [box-shadow:var(--website-button-ring)]"
			)}
			nativeButton={false}
			render={
				<LinkComponent {...linkElementProps} data-action={href.kind} href={href.href}>
					{children}
				</LinkComponent>
			}
			style={actionStyle}
		/>
	);
};
