import type React from "react";

import { StyleSheet, Text } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, resolvePdfColor, type PdfxTheme } from "../../lib/theme";

export type HeadingWeight = "normal" | "medium" | "semibold" | "bold";

export type HeadingTracking = "tighter" | "tight" | "normal" | "wide" | "wider";

export type HeadingProps = {
	align?: "left" | "center" | "right";
	children: React.ReactNode;
	color?: string;
	keepWithNext?: boolean;
	level?: 1 | 2 | 3 | 4 | 5 | 6;
	noMargin?: boolean;
	style?: Style;
	tracking?: HeadingTracking;
	transform?: "uppercase" | "lowercase" | "capitalize";
	weight?: HeadingWeight;
};

const createHeadingStyles = (t: PdfxTheme) => {
	const { heading } = t.typography;
	const { fontWeights, letterSpacing, spacing } = t.primitives;
	const { componentGap, paragraphGap, sectionGap } = t.spacing;

	const base = {
		color: t.colors.foreground,
		fontFamily: heading.fontFamily,
		fontWeight: fontWeights.bold,
		lineHeight: heading.lineHeight,
	};

	return StyleSheet.create({
		capitalize: { textTransform: "capitalize" },
		h1: { ...base, fontSize: heading.fontSize.h1, marginBottom: paragraphGap, marginTop: spacing[0] },
		h2: { ...base, fontSize: heading.fontSize.h2, marginBottom: paragraphGap, marginTop: sectionGap },
		h3: { ...base, fontSize: heading.fontSize.h3, marginBottom: paragraphGap, marginTop: componentGap },
		h4: { ...base, fontSize: heading.fontSize.h4, marginBottom: paragraphGap, marginTop: paragraphGap },
		h5: { ...base, fontSize: heading.fontSize.h5, marginBottom: spacing[1], marginTop: paragraphGap },
		h6: { ...base, fontSize: heading.fontSize.h6, marginBottom: spacing[1], marginTop: paragraphGap },
		lowercase: { textTransform: "lowercase" },
		noMargin: { marginBottom: 0, marginTop: 0 },
		trackingNormal: { letterSpacing: letterSpacing.normal },
		trackingTight: { letterSpacing: letterSpacing.tight * 10 },
		trackingTighter: { letterSpacing: letterSpacing.tight * 15 },
		trackingWide: { letterSpacing: letterSpacing.wide * 10 },
		trackingWider: { letterSpacing: letterSpacing.wider * 10 },
		uppercase: { letterSpacing: letterSpacing.wider * 10, textTransform: "uppercase" },
		weightBold: { fontWeight: fontWeights.bold },
		weightMedium: { fontWeight: fontWeights.medium },
		weightNormal: { fontWeight: fontWeights.regular },
		weightSemibold: { fontWeight: fontWeights.semibold },
	});
};

export const Heading = ({
	align,
	children,
	color,
	keepWithNext = true,
	level = 1,
	noMargin,
	style,
	tracking,
	transform,
	weight,
}: HeadingProps) => {
	const theme = defaultTheme;
	const styles = createHeadingStyles(theme);

	const weightMap = {
		bold: styles.weightBold,
		medium: styles.weightMedium,
		normal: styles.weightNormal,
		semibold: styles.weightSemibold,
	};

	const trackingMap = {
		normal: styles.trackingNormal,
		tight: styles.trackingTight,
		tighter: styles.trackingTighter,
		wide: styles.trackingWide,
		wider: styles.trackingWider,
	};

	const transformMap = { capitalize: styles.capitalize, lowercase: styles.lowercase, uppercase: styles.uppercase };

	const styleArray: Array<Style> = [
		{
			1: styles.h1,
			2: styles.h2,
			3: styles.h3,
			4: styles.h4,
			5: styles.h5,
			6: styles.h6,
		}[level],
	];

	if (weight) {
		styleArray.push(weightMap[weight]);
	}

	if (tracking) {
		styleArray.push(trackingMap[tracking]);
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

	return (
		<Text minPresenceAhead={keepWithNext ? 80 : undefined} style={styleArray}>
			{children}
		</Text>
	);
};
