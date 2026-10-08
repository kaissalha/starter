import type { CSSProperties, HTMLAttributes } from "react";

import { cva } from "class-variance-authority";

import { pendingTextContent } from "../document/content-schema";
import type { Layout } from "../document/structure-schema";
import { layoutStyle, setResponsiveValue } from "./layout";
import { ScrollWords } from "./reveal";
import type { NodeProps } from "./shared";
import { inferTypographyAppearance, typographyAppearanceStyle } from "./typography";

const textVariants = cva("max-w-full whitespace-pre-line", {
	defaultVariants: { font: "body", tone: "primary", wrap: "normal" },
	variants: {
		font: { body: "font-body", brand: "font-brand", mono: "font-mono" },
		tone: {
			accent: "text-accent-foreground",
			"accent-text": "text-accent-primary",
			action: "text-action-foreground",
			current: "text-current",
			featured: "text-[var(--website-on-featured)]",
			media: "text-[var(--website-on-media)]",
			muted: "text-foreground-muted",
			primary: "text-foreground-primary",
		},
		wrap: { balance: "text-balance", normal: "text-wrap", pretty: "text-pretty" },
	},
});

const elementByName = {
	h1: "h1",
	h2: "h2",
	h3: "h3",
	h4: "h4",
	p: "p",
	span: "span",
} as const;

const skeletonLines = ["first", "second", "third"] as const;

export type TextElementProps = Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "style">;

export const Text = ({
	align,
	appearance,
	content,
	decoration,
	element = "p",
	elementProps,
	font,
	fontSize,
	layout,
	lineHeight: _lineHeight,
	scrollReveal,
	style: fontStyle,
	tone,
	tracking,
	transform,
	weight,
	wrap,
}: NodeProps<"text"> & { elementProps?: TextElementProps; layout?: Layout }) => {
	const Element = elementByName[element];
	const style: CSSProperties = layoutStyle(layout);
	style["--iw-default-display"] = element === "span" ? "inline" : "block";
	setResponsiveValue({ name: "text-align", serialize: String, style, value: align });

	const resolvedAppearance = inferTypographyAppearance({
		appearance,
		element,
		fontSize,
		tracking,
		transform,
		weight,
	});

	Object.assign(style, typographyAppearanceStyle({ appearance: resolvedAppearance }));
	const fontRole = font === "brand" ? "heading" : "body";
	style.fontStyle = fontStyle ?? (font !== "mono" ? `var(--website-${fontRole}-style)` : undefined);

	style.fontVariationSettings =
		resolvedAppearance.startsWith("display") || resolvedAppearance === "watermark"
			? "var(--website-heading-axes)"
			: "var(--website-body-axes)";

	style.textTransform = transform;
	style.textDecoration = decoration;
	const pending = content === pendingTextContent;

	return (
		<Element
			{...elementProps}
			aria-busy={pending || elementProps?.["aria-busy"]}
			className={`iw-layout iw-text ${textVariants({ font, tone, wrap })}`}
			data-appearance={resolvedAppearance}
			data-pending={pending ? "" : undefined}
			style={style}
		>
			{pending ? (
				<span aria-hidden='true' className='iw-text-skeleton'>
					{skeletonLines
						.slice(0, element === "p" && resolvedAppearance.startsWith("body") ? 3 : 1)
						.map((line) => (
							<span className='iw-text-skeleton-line' key={line} />
						))}
				</span>
			) : (
				<>{scrollReveal ? <ScrollWords content={content} /> : content}</>
			)}
		</Element>
	);
};
