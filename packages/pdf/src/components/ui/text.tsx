import type React from "react";

import { Text as PDFText, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";
import { resolvePdfColor } from "./utils/color";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export type TextVariant = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";

export type TextWeight = "normal" | "medium" | "semibold" | "bold";

export type TextDecoration = "underline" | "line-through" | "none";

export type TextProps = {
	align?: "left" | "center" | "right" | "justify";
	children: React.ReactNode;
	color?: string;
	decoration?: TextDecoration;
	italic?: boolean;
	noMargin?: boolean;
	style?: Style;
	transform?: "uppercase" | "lowercase" | "capitalize";
	variant?: TextVariant;
	weight?: TextWeight;
};

const createTextStyles = (t: PdfxTheme) => {
	const { fontWeights, letterSpacing } = t.primitives;

	const base = {
		color: t.colors.foreground,
		fontFamily: t.typography.body.fontFamily,
		lineHeight: t.typography.body.lineHeight,
		marginBottom: t.spacing.paragraphGap,
		marginTop: 0,
	};

	return StyleSheet.create({
		"2xl": { ...base, fontSize: t.primitives.typography["2xl"] },
		"3xl": { ...base, fontSize: t.primitives.typography["3xl"] },
		base: { ...base, fontSize: t.primitives.typography.base },
		capitalize: { textTransform: "capitalize" },
		decorationNone: { textDecoration: "none" },
		italic: { fontStyle: "italic" },
		lg: { ...base, fontSize: t.primitives.typography.lg },
		lineThrough: { textDecoration: "line-through" },
		lowercase: { textTransform: "lowercase" },
		noMargin: { marginBottom: 0, marginTop: 0 },
		sm: { ...base, fontSize: t.primitives.typography.sm },
		text: { ...base, fontSize: t.typography.body.fontSize },
		underline: { textDecoration: "underline" },
		uppercase: { letterSpacing: letterSpacing.wider * 10, textTransform: "uppercase" },
		weightBold: { fontWeight: fontWeights.bold },
		weightMedium: { fontWeight: fontWeights.medium },
		weightNormal: { fontWeight: fontWeights.regular },
		weightSemibold: { fontWeight: fontWeights.semibold },
		xl: { ...base, fontSize: t.primitives.typography.xl },
		xs: { ...base, fontSize: t.primitives.typography.xs },
	});
};

export const Text = ({
	align,
	children,
	color,
	decoration,
	italic,
	noMargin,
	style,
	transform,
	variant,
	weight,
}: TextProps) => {
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createTextStyles(theme), [theme]);

	const weightMap = {
		bold: styles.weightBold,
		medium: styles.weightMedium,
		normal: styles.weightNormal,
		semibold: styles.weightSemibold,
	};

	const decorationMap = {
		"line-through": styles.lineThrough,
		none: styles.decorationNone,
		underline: styles.underline,
	};

	const transformMap = { capitalize: styles.capitalize, lowercase: styles.lowercase, uppercase: styles.uppercase };
	const styleArray: Array<Style> = [variant ? styles[variant] : styles.text];

	if (weight) {
		styleArray.push(weightMap[weight]);
	}

	if (italic) {
		styleArray.push(styles.italic);
	}

	if (decoration) {
		styleArray.push(decorationMap[decoration]);
	}

	if (transform) {
		styleArray.push(transformMap[transform]);
	}

	if (noMargin) {
		styleArray.push(styles.noMargin);
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

	return <PDFText style={styleArray}>{children}</PDFText>;
};
