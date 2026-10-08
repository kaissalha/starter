import type { CSSProperties } from "react";

import { cva } from "class-variance-authority";
import { cn } from "cn";

import type { BoxAppearance, Radius } from "../document/structure-schema";
import { lengthToCss, setResponsiveValue } from "./layout";

const appearanceVariants = cva("", {
	variants: {
		fill: {
			accent: "bg-accent-primary [--accent-foreground:var(--website-on-accent)]",
			action: "bg-action-primary",
			black: "bg-black",
			border: "bg-border-subtle",
			canvas: "bg-surface-canvas",
			current: "bg-current",
			featured:
				"bg-surface-featured [--foreground-muted:var(--website-on-featured-muted)] [--foreground-primary:var(--website-on-featured)]",
			subtle: "bg-surface-subtle [--foreground-muted:var(--website-on-subtle-muted)] [--foreground-primary:var(--website-on-subtle)]",
			tint: "bg-foreground-primary/5",
			transparent: "bg-transparent",
		},
		foreground: {
			accent: "text-accent-foreground",
			"accent-text": "text-accent-primary",
			action: "text-action-foreground",
			current: "text-current",
			featured:
				"text-[var(--website-on-featured)] [--foreground-muted:var(--website-on-featured-muted)] [--foreground-primary:var(--website-on-featured)]",
			media: "text-[var(--website-on-media)] [--foreground-muted:var(--website-on-media-muted)] [--foreground-primary:var(--website-on-media)]",
			muted: "text-foreground-muted",
			primary: "text-foreground-primary",
		},
		pattern: { "diagonal-slash": "iw-pattern" },
	},
});

const colorValue = (color: "border" | "accent" | "action" | "current") => {
	if (color === "border") {
		return "var(--border-subtle)";
	}

	if (color === "accent") {
		return "var(--accent-primary)";
	}

	if (color === "action") {
		return "var(--action-primary)";
	}

	return "currentColor";
};

type RadiusRole = "control" | "media" | "surface";

type CornerRadius = Exclude<Radius, object>;

const radiusValue = ({ radius, role }: { radius: CornerRadius; role: RadiusRole }) => {
	if (radius === "none") {
		return "0";
	}

	if (radius === "theme") {
		return role === "surface" ? "var(--website-radius)" : `var(--website-radius-${role})`;
	}

	if (radius === "full") {
		return "9999px";
	}

	return lengthToCss(radius);
};

const cornerRadius = ({ radius, role }: { radius?: CornerRadius; role: RadiusRole }) =>
	radius === undefined ? undefined : radiusValue({ radius, role });

const fillColor = (fill: NonNullable<BoxAppearance["fill"]>) => {
	if (fill === "canvas") {
		return "var(--surface-canvas)";
	}

	if (fill === "subtle") {
		return "var(--surface-subtle)";
	}

	if (fill === "featured") {
		return "var(--surface-featured)";
	}

	if (fill === "border") {
		return "var(--border-subtle)";
	}

	if (fill === "action") {
		return "var(--action-primary)";
	}

	if (fill === "accent") {
		return "var(--accent-primary)";
	}

	if (fill === "black") {
		return "black";
	}

	if (fill === "current") {
		return "currentColor";
	}

	if (fill === "transparent") {
		return "transparent";
	}

	return "color-mix(in srgb, currentColor 5%, transparent)";
};

const gradientColor = (color: "transparent" | "black" | "featured", opacity = 1) => {
	if (color === "transparent") {
		return "transparent";
	}

	if (color === "featured") {
		return `color-mix(in srgb, var(--surface-featured) ${opacity * 100}%, transparent)`;
	}

	return `rgb(0 0 0 / ${opacity})`;
};

export const appearance = ({
	background,
	border,
	fill,
	fillOpacity,
	foreground,
	opacity,
	pattern,
	radius,
	radiusRole = "surface",
}: BoxAppearance & { radiusRole?: RadiusRole }) => {
	const style: CSSProperties = { opacity };

	if (fill === "canvas" || fill === "tint") {
		style["--foreground-primary"] = "var(--website-foreground-base)";
		style["--foreground-muted"] = "var(--website-muted-base)";
	}

	const responsiveFillOpacity = fillOpacity instanceof Object;

	if (fill && fillOpacity !== undefined && !(fillOpacity instanceof Object)) {
		style.backgroundColor = `color-mix(in srgb, ${fillColor(fill)} ${fillOpacity * 100}%, transparent)`;
	}

	if (fill && fillOpacity instanceof Object) {
		style["--iw-fill-color"] = fillColor(fill);
		setResponsiveValue({ name: "fill-opacity", serialize: String, style, value: fillOpacity });
	}

	if (radius instanceof Object) {
		style.borderStartStartRadius = cornerRadius({ radius: radius.startStart, role: radiusRole });
		style.borderStartEndRadius = cornerRadius({ radius: radius.startEnd, role: radiusRole });
		style.borderEndStartRadius = cornerRadius({ radius: radius.endStart, role: radiusRole });
		style.borderEndEndRadius = cornerRadius({ radius: radius.endEnd, role: radiusRole });
	} else if (radius !== undefined) {
		style.borderRadius = radiusValue({ radius, role: radiusRole });
	}

	if (border) {
		const width = lengthToCss(border.width);
		style.borderStyle = "solid";
		style.borderColor = colorValue(border.color);

		if (!border.sides || border.sides.length === 4) {
			style.borderWidth = width;
		} else {
			if (border.sides.includes("block-start")) {
				style.borderBlockStartWidth = width;
			}

			if (border.sides.includes("inline-end")) {
				style.borderInlineEndWidth = width;
			}

			if (border.sides.includes("block-end")) {
				style.borderBlockEndWidth = width;
			}

			if (border.sides.includes("inline-start")) {
				style.borderInlineStartWidth = width;
			}
		}
	}

	if (background) {
		style.backgroundImage = `linear-gradient(${background.angle}deg, ${background.stops
			.map((stop) => `${gradientColor(stop.color, stop.opacity)} ${stop.position}%`)
			.join(", ")})`;
	}

	return {
		className: cn(appearanceVariants({ fill, foreground, pattern }), responsiveFillOpacity && "iw-fill-opacity"),
		style,
	};
};
