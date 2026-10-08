import type React from "react";

import { StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";
import { resolvePdfColor } from "./utils/color";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export type SectionSpacing = "none" | "sm" | "md" | "lg" | "xl";

export type SectionPadding = "none" | "sm" | "md" | "lg";

export type SectionVariant = "default" | "callout" | "highlight" | "card";

export type SectionProps = {
	accentColor?: string;
	background?: string;
	border?: boolean;
	children: React.ReactNode;
	noWrap?: boolean;
	padding?: SectionPadding;
	spacing?: SectionSpacing;
	style?: Style;
	variant?: SectionVariant;
};

const createSectionStyles = (t: PdfxTheme) => {
	const { borderRadius, spacing } = t.primitives;

	return StyleSheet.create({
		base: { flexDirection: "column" },
		border: {
			borderColor: t.colors.border,
			borderRadius: borderRadius.md,
			borderStyle: "solid",
			borderWidth: spacing[0.5],
		},
		callout: {
			borderLeftColor: t.colors.primary,
			borderLeftStyle: "solid",
			borderLeftWidth: spacing[1],
			paddingLeft: spacing[4],
			paddingVertical: spacing[2],
		},
		card: {
			borderColor: t.colors.border,
			borderRadius: borderRadius.md,
			borderStyle: "solid",
			borderWidth: spacing[0.5],
			padding: spacing[4],
		},
		highlight: {
			backgroundColor: t.colors.muted,
			borderLeftColor: t.colors.primary,
			borderLeftStyle: "solid",
			borderLeftWidth: spacing[1],
			padding: spacing[4],
		},
		paddingLg: { padding: spacing[6] },
		paddingMd: { padding: spacing[4] },
		paddingNone: { padding: spacing[0] },
		paddingSm: { padding: spacing[3] },
		spacingLg: { marginVertical: spacing[8] },
		spacingMd: { marginVertical: t.spacing.sectionGap },
		spacingNone: { marginVertical: spacing[0] },
		spacingSm: { marginVertical: spacing[4] },
		spacingXl: { marginVertical: spacing[12] },
	});
};

export const Section = ({
	accentColor,
	background,
	border,
	children,
	noWrap = false,
	padding,
	spacing = "md",
	style,
	variant = "default",
}: SectionProps) => {
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createSectionStyles(theme), [theme]);

	const spacingMap = {
		lg: styles.spacingLg,
		md: styles.spacingMd,
		none: styles.spacingNone,
		sm: styles.spacingSm,
		xl: styles.spacingXl,
	};

	const paddingMap = { lg: styles.paddingLg, md: styles.paddingMd, none: styles.paddingNone, sm: styles.paddingSm };

	const variantMap = {
		callout: styles.callout,
		card: styles.card,
		default: null,
		highlight: styles.highlight,
	} satisfies Record<SectionVariant, Style | null>;

	const styleArray: Array<Style> = [styles.base, spacingMap[spacing]];
	const variantStyle = variantMap[variant];

	if (variantStyle) {
		styleArray.push(variantStyle);
	}

	if (accentColor && (variant === "callout" || variant === "highlight")) {
		styleArray.push({ borderLeftColor: resolvePdfColor(accentColor, theme.colors) });
	}

	if (padding) {
		styleArray.push(paddingMap[padding]);
	}

	if (border && variant === "default") {
		styleArray.push(styles.border);
	}

	if (background) {
		styleArray.push({ backgroundColor: resolvePdfColor(background, theme.colors) });
	}

	if (style) {
		styleArray.push(...[style].flat());
	}

	return (
		<View style={styleArray} wrap={noWrap ? false : undefined}>
			{children}
		</View>
	);
};
