import type { CSSProperties } from "react";

import {
	findBrandTypeScale,
	type BrandTypeScale,
	getBrandFont,
	resolveBrandFontSelection,
} from "@starter/infinite-brand";
import { getDirection } from "@starter/utils";

import "./css-custom-properties";

import type { WebsiteTheme } from "./brand/brand-projection";

export { projectBrandToWebsiteTheme, type WebsiteTheme } from "./brand/brand-projection";

export type TextDirection = "ltr" | "rtl";

const scaleVariables = ({ brandFamily, typography }: { brandFamily: string; typography: WebsiteTheme["typography"] }) =>
	Object.fromEntries(
		Object.entries<BrandTypeScale[string]>(findBrandTypeScale({ typography })).flatMap(([appearance, override]) => [
			...(override.weight === undefined ? [] : [[`--website-type-${appearance}-weight`, override.weight]]),
			...(override.tracking === undefined ? [] : [[`--website-type-${appearance}-tracking`, override.tracking]]),
			...(override.lineHeight === undefined
				? []
				: [[`--website-type-${appearance}-line-height`, override.lineHeight]]),
			...(override.brandFont ? [[`--website-type-${appearance}-family`, brandFamily]] : []),
		])
	);

export const resolveTextDirection = ({ direction, locale }: { direction?: TextDirection; locale: string }) => {
	if (direction) {
		return direction;
	}

	return getDirection(locale);
};

const resolveFont = ({ locale, role }: { locale: string; role: WebsiteTheme["typography"]["heading"] }) => {
	const selection = resolveBrandFontSelection({ locale, role });
	const font = getBrandFont({ fontId: selection.fontId });

	if (!font) {
		throw new Error(`Unknown Brand font "${selection.fontId}"`);
	}

	const axes = Object.entries(selection.axes ?? {})
		.map(([axis, value]) => `"${axis}" ${value}`)
		.join(", ");

	return {
		axes: axes || "normal",
		family: `'${font.family}', ${font.fallback}`,
		fontId: selection.fontId,
		weight: selection.weight,
	};
};

export const themeToCssVariables = ({ locale, theme }: { locale: string; theme: WebsiteTheme }): CSSProperties => {
	const heading = resolveFont({ locale, role: theme.typography.heading });
	const body = resolveFont({ locale, role: theme.typography.body });
	const outline = theme.buttons.style === "outline";

	return {
		"--accent-foreground": theme.colors.accentText,
		"--accent-primary": theme.colors.accent,
		"--action-foreground": theme.colors.onAction,
		"--action-primary": theme.colors.action,
		"--border-subtle": theme.colors.border,
		"--foreground-muted": theme.colors.muted,
		"--foreground-primary": theme.colors.foreground,
		"--surface-canvas": theme.colors.canvas,
		"--surface-featured": theme.colors.featured,
		"--surface-subtle": theme.colors.subtle,
		"--website-body-axes": body.axes,
		"--website-body-weight": body.weight,
		"--website-button-fill": outline ? "transparent" : "var(--action-primary)",
		"--website-button-foreground": outline ? "currentColor" : "var(--action-foreground)",
		"--website-button-ring": outline ? "inset 0 0 0 1.5px currentColor" : "none",
		"--website-font-body": body.family,
		"--website-font-brand": heading.family,
		"--website-font-mono": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
		"--website-foreground-base": theme.colors.foreground,
		"--website-heading-axes": heading.axes,
		"--website-heading-weight": heading.weight,
		"--website-muted-base": theme.colors.muted,
		"--website-on-accent": theme.colors.onAccent,
		"--website-on-featured": theme.colors.onFeatured,
		"--website-on-featured-muted": theme.colors.onFeaturedMuted,
		"--website-on-media": theme.colors.onMedia,
		"--website-on-media-muted": theme.colors.onMediaMuted,
		"--website-on-subtle": theme.colors.onSubtle,
		"--website-on-subtle-muted": theme.colors.onSubtleMuted,
		"--website-radius": theme.radius,
		"--website-radius-control": theme.radii.control,
		"--website-radius-media": theme.radii.media,
		...scaleVariables({ brandFamily: heading.family, typography: theme.typography }),
	};
};
