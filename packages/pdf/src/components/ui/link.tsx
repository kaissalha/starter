import type React from "react";

import { Link as PDFLink, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, resolvePdfColor, type PdfxTheme } from "../../lib/theme";

export type LinkVariant = "default" | "muted" | "primary";

export type LinkUnderline = "always" | "none";

export type LinkProps = {
	align?: "left" | "center" | "right";
	children: React.ReactNode;
	color?: string;
	href: string;
	style?: Style;
	underline?: LinkUnderline;
	variant?: LinkVariant;
};

const createLinkStyles = (t: PdfxTheme) => {
	const { fontWeights } = t.primitives;

	const base = {
		fontFamily: t.typography.body.fontFamily,
		fontSize: t.typography.body.fontSize,
		lineHeight: t.typography.body.lineHeight,
		marginBottom: t.spacing.paragraphGap,
	};

	return StyleSheet.create({
		default: { ...base, color: t.colors.accent, fontWeight: fontWeights.medium, textDecoration: "underline" },
		muted: {
			...base,
			color: t.colors.mutedForeground,
			fontWeight: fontWeights.regular,
			textDecoration: "underline",
		},
		primary: { ...base, color: t.colors.primary, fontWeight: fontWeights.semibold, textDecoration: "underline" },
		underlineAlways: { textDecoration: "underline" },
		underlineNone: { textDecoration: "none" },
	});
};

export const Link = ({ align, children, color, href, style, underline, variant = "default" }: LinkProps) => {
	const theme = defaultTheme;
	const styles = createLinkStyles(theme);
	const variantMap = { default: styles.default, muted: styles.muted, primary: styles.primary };
	const underlineMap = { always: styles.underlineAlways, none: styles.underlineNone };
	const styleArray: Array<Style> = [variantMap[variant]];

	if (underline) {
		styleArray.push(underlineMap[underline]);
	}

	const semantic: Style = {};

	if (align) {
		semantic.textAlign = align;
	}

	if (color) {
		semantic.color = resolvePdfColor(color, theme.colors);
	}

	if (Object.keys(semantic).length > 0) {
		styleArray.push(semantic);
	}

	if (style) {
		styleArray.push(...[style].flat());
	}

	return (
		<PDFLink src={href} style={styleArray}>
			{children}
		</PDFLink>
	);
};
