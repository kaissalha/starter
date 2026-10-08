import type { CSSProperties } from "react";

import { cva } from "class-variance-authority";
import { cn } from "cn";

import type { Layout } from "../document/structure-schema";
import { type VinylGlyph, vinylGlyphs } from "./icon-filled-shapes";
import { layoutStyle, lengthToCss, setResponsiveValue } from "./layout";
import type { NodeProps } from "./shared";

const strokePaths = {
	"chevron-down": "M1 1l4 4 4-4",
	"chevron-end": "m9 18 6-6-6-6",
	"chevron-start": "m15 18-6-6 6-6",
	email: "M4 6h16v12H4V6Zm0 1 8 6 8-6",
	facebook: "M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1Z",
	instagram:
		"M12 7.2A4.8 4.8 0 1 0 16.8 12 4.8 4.8 0 0 0 12 7.2Zm0 7.9A3.1 3.1 0 1 1 15.1 12 3.1 3.1 0 0 1 12 15.1ZM17.4 6.9a1.1 1.1 0 1 0 1.1 1.1 1.1 1.1 0 0 0-1.1-1.1ZM21.2 7.2a5.7 5.7 0 0 0-1.6-4 5.7 5.7 0 0 0-4-1.6H8.4a5.7 5.7 0 0 0-4 1.6 5.7 5.7 0 0 0-1.6 4v8.4a5.7 5.7 0 0 0 1.6 4 5.7 5.7 0 0 0 4 1.6h7.2a5.7 5.7 0 0 0 4-1.6 5.7 5.7 0 0 0 1.6-4ZM19.5 16a3.9 3.9 0 0 1-1.1 2.7A3.9 3.9 0 0 1 15.7 20H8.3a3.9 3.9 0 0 1-2.7-1.1A3.9 3.9 0 0 1 4.5 16V8.4A3.9 3.9 0 0 1 5.6 5.7 3.9 3.9 0 0 1 8.3 4.5h7.4a3.9 3.9 0 0 1 2.7 1.2A3.9 3.9 0 0 1 19.5 8.4Z",
	linkedin:
		"M6.5 9H4v11h2.5ZM5.2 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM20 20h-2.5v-5.4c0-1.4-.5-2.4-1.8-2.4a1.9 1.9 0 0 0-1.8 1.3 2 2 0 0 0-.1.9V20H11v-6.5c0-1.7 0-3.1-.1-4.1H13l.1 1.8h.1a3.2 3.2 0 0 1 2.9-1.6c2.1 0 3.7 1.4 3.7 4.3Z",
	"location-pin": "M12 21s7-5.7 7-12A7 7 0 1 0 5 9c0 6.3 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
	menu: "M1 1h14M1 6h14M1 11h14",
	phone: "M7.2 3H4.5C3.7 3 3 3.7 3 4.5 3 13.6 10.4 21 19.5 21c.8 0 1.5-.7 1.5-1.5v-2.7l-4.2-1.4-1.3 2.2a15.7 15.7 0 0 1-8.6-8.6l2.2-1.3L7.2 3Z",
	pinterest:
		"M12 2a10 10 0 0 0-3.6 19.4c0-1.1.2-2.5.6-3.6l1.7-6.5a2.5 2.5 0 0 1-.2-1.1c0-1.1.6-1.9 1.5-1.9.7 0 1.1.5 1.1 1.2 0 .7-.5 1.8-.7 2.8-.2.9.4 1.6 1.3 1.6 1.5 0 2.5-1.6 2.5-3.8A3.5 3.5 0 0 0 12.2 5a3.8 3.8 0 0 0-4 3.9c0 .7.3 1.5.7 1.9a.3.3 0 0 1 .1.3l-.3 1.1c0 .1-.2.2-.3.1-1.2-.6-1.9-2.2-1.9-3.6C6.5 6.4 8.9 3.8 12.7 3.8c3.2 0 5.5 2.3 5.5 5.1 0 3.2-1.9 5.6-4.6 5.6-.9 0-1.8-.5-2.1-1.1l-.6 2.2a8 8 0 0 1-.9 1.9A10 10 0 1 0 12 2Z",
	plus: "M6 1v10M1 6h10",
	x: "M4 4h3.2l4 5.4L15.5 4H19l-5.8 7.2L19.5 20h-3.2l-4.3-5.7L7.3 20H4l6.1-7.6L4 4Z",
	youtube:
		"M22 8.2a2.8 2.8 0 0 0-2-2C18.2 6 12 6 12 6s-6.2 0-8 .2a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1.7 12a29 29 0 0 0 .3 3.8 2.8 2.8 0 0 0 2 2C5.8 18 12 18 12 18s6.2 0 8-.2a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .3-3.8A29 29 0 0 0 22 8.2ZM10 14.8V9.2L15 12Z",
} satisfies Partial<Record<NodeProps<"icon">["name"], string>>;

const viewBoxByName = {
	"chevron-down": "0 0 10 6",
	menu: "0 0 16 12",
	plus: "0 0 12 12",
} satisfies Partial<Record<NodeProps<"icon">["name"], string>>;

const iconTone = cva("", {
	defaultVariants: { tone: "current" },
	variants: {
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
	},
});

const directionalIconNames: Array<NodeProps<"icon">["name"]> = [
	"chevron-start",
	"chevron-end",
	"arrow-start",
	"arrow-end",
	"arrow-up-right",
];

const filledIconNames: Array<NodeProps<"icon">["name"]> = [
	"instagram",
	"facebook",
	"pinterest",
	"x",
	"linkedin",
	"youtube",
];

export const Icon = ({
	filled = false,
	label,
	layout,
	name,
	size = "1rem",
	tone = "current",
}: NodeProps<"icon"> & { layout?: Layout }) => {
	const style: CSSProperties = { ...layoutStyle(layout), "--iw-default-display": "inline-block" };
	setResponsiveValue({ name: "icon-size", serialize: lengthToCss, style, value: size });
	const strokePath = Object.entries(strokePaths).find(([iconName]) => iconName === name)?.[1];
	const glyph: VinylGlyph | undefined = Object.entries(vinylGlyphs).find(([iconName]) => iconName === name)?.[1];
	const isVinyl = glyph !== undefined && (filled || strokePath === undefined);
	const isFilled = isVinyl || filledIconNames.includes(name);
	const isDirectional = directionalIconNames.includes(name);

	const viewBox = isVinyl
		? glyph.viewBox
		: (Object.entries(viewBoxByName).find(([iconName]) => iconName === name)?.[1] ?? "0 0 24 24");

	return (
		<svg
			aria-hidden={label ? undefined : true}
			aria-label={label}
			className={cn(
				"iw-layout iw-icon shrink-0",
				isDirectional && "iw-directional-icon",
				isFilled ? "fill-current stroke-none" : "fill-none stroke-current stroke-2",
				iconTone({ tone })
			)}
			role={label ? "img" : undefined}
			style={style}
			viewBox={viewBox}
		>
			<path
				d={isVinyl ? glyph.d : strokePath}
				fillRule={isVinyl ? "evenodd" : undefined}
				strokeLinecap={isFilled ? undefined : "round"}
				strokeLinejoin={isFilled ? undefined : "round"}
				transform={isVinyl ? glyph.transform : undefined}
			/>
		</svg>
	);
};
