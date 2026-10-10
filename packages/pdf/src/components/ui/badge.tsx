import { Text as PDFText, StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, resolvePdfColor, type PdfxTheme } from "../../lib/theme";

export type BadgeVariant =
	| "default"
	| "secondary"
	| "primary"
	| "success"
	| "warning"
	| "destructive"
	| "info"
	| "outline"
	| "optimal"
	| "suboptimal"
	| "critical";

export type BadgeSize = "sm" | "md" | "lg";

export type BadgeProps = {
	background?: string;
	children?: string;
	color?: string;
	label?: string;
	size?: BadgeSize;
	style?: Style;
	variant?: BadgeVariant;
};

const tintOnWhite = (hex: string, strength: number) => {
	const normalized = hex.replace("#", "");
	const red = Number.parseInt(normalized.slice(0, 2), 16);
	const green = Number.parseInt(normalized.slice(2, 4), 16);
	const blue = Number.parseInt(normalized.slice(4, 6), 16);
	const mix = (channel: number) => Math.round(255 - (255 - channel) * strength);

	return `#${mix(red).toString(16).padStart(2, "0")}${mix(green).toString(16).padStart(2, "0")}${mix(blue).toString(16).padStart(2, "0")}`;
};

const createBadgeStyles = (t: PdfxTheme) => {
	const { borderRadius, fontWeights, spacing } = t.primitives;
	const c = t.colors;

	const textBase = {
		fontFamily: t.typography.body.fontFamily,
		fontWeight: fontWeights.semibold,
		letterSpacing: 0,
	};

	const transparentBorder = {
		borderColor: "transparent",
		borderStyle: "solid" as const,
		borderWidth: 0,
	};

	const sheet = StyleSheet.create({
		containerBase: {
			alignItems: "center" as const,
			alignSelf: "flex-start" as const,
			borderRadius: borderRadius.full,
			flexDirection: "row" as const,
			flexShrink: 0,
		},
		sizeLg: { paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
		sizeMd: { paddingHorizontal: spacing[2], paddingVertical: 1 },
		sizeSm: { paddingHorizontal: 6, paddingVertical: 1 },
		textCritical: { ...textBase, color: c.destructive },
		textDefault: { ...textBase, color: c.mutedForeground },
		textDestructive: { ...textBase, color: c.mutedForeground },
		textInfo: { ...textBase, color: c.mutedForeground },
		textLg: { fontSize: 14, lineHeight: 1.2 },
		textMd: { fontSize: 12, lineHeight: 1.2 },
		textOptimal: { ...textBase, color: c.successForeground },
		textOutline: { ...textBase, color: c.mutedForeground },
		textPrimary: { ...textBase, color: c.primary },
		textSecondary: { ...textBase, color: c.primary },
		textSm: { fontSize: 10, lineHeight: 1.2 },
		textSuboptimal: { ...textBase, color: c.warningForeground },
		textSuccess: { ...textBase, color: c.mutedForeground },
		textWarning: { ...textBase, color: c.mutedForeground },
		variantCritical: {
			...transparentBorder,
			backgroundColor: tintOnWhite(c.destructive, 0.1),
		},
		variantDefault: {
			...transparentBorder,
			backgroundColor: c.muted,
		},
		variantDestructive: {
			...transparentBorder,
			backgroundColor: tintOnWhite(c.destructive, 0.1),
		},
		variantInfo: {
			...transparentBorder,
			backgroundColor: tintOnWhite(c.info, 0.2),
		},
		variantOptimal: {
			...transparentBorder,
			backgroundColor: tintOnWhite(c.success, 0.2),
		},
		variantOutline: {
			backgroundColor: c.background,
			borderColor: c.border,
			borderStyle: "solid" as const,
			borderWidth: 1,
		},
		variantPrimary: {
			...transparentBorder,
			backgroundColor: c.muted,
		},
		variantSecondary: {
			...transparentBorder,
			backgroundColor: c.muted,
		},
		variantSuboptimal: {
			...transparentBorder,
			backgroundColor: tintOnWhite(c.warning, 0.2),
		},
		variantSuccess: {
			...transparentBorder,
			backgroundColor: tintOnWhite(c.success, 0.2),
		},
		variantWarning: {
			...transparentBorder,
			backgroundColor: tintOnWhite(c.warning, 0.2),
		},
	});

	return {
		...sheet,
		containerSizeMap: { lg: sheet.sizeLg, md: sheet.sizeMd, sm: sheet.sizeSm } satisfies Record<BadgeSize, Style>,
		containerVariantMap: {
			critical: sheet.variantCritical,
			default: sheet.variantDefault,
			destructive: sheet.variantDestructive,
			info: sheet.variantInfo,
			optimal: sheet.variantOptimal,
			outline: sheet.variantOutline,
			primary: sheet.variantPrimary,
			secondary: sheet.variantSecondary,
			suboptimal: sheet.variantSuboptimal,
			success: sheet.variantSuccess,
			warning: sheet.variantWarning,
		} satisfies Record<BadgeVariant, Style>,
		textSizeMap: { lg: sheet.textLg, md: sheet.textMd, sm: sheet.textSm } satisfies Record<BadgeSize, Style>,
		textVariantMap: {
			critical: sheet.textCritical,
			default: sheet.textDefault,
			destructive: sheet.textDestructive,
			info: sheet.textInfo,
			optimal: sheet.textOptimal,
			outline: sheet.textOutline,
			primary: sheet.textPrimary,
			secondary: sheet.textSecondary,
			suboptimal: sheet.textSuboptimal,
			success: sheet.textSuccess,
			warning: sheet.textWarning,
		} satisfies Record<BadgeVariant, Style>,
	};
};

export const Badge = ({ background, children, color, label, size = "md", style, variant = "default" }: BadgeProps) => {
	const theme = defaultTheme;
	const styles = createBadgeStyles(theme);
	const text = label ?? children ?? "";

	const containerStyles: Array<Style> = [
		styles.containerBase,
		styles.containerVariantMap[variant],
		styles.containerSizeMap[size],
		...(background ? [{ backgroundColor: resolvePdfColor(background, theme.colors) }] : []),
		...(style ? [style].flat() : []),
	];

	const textStyles: Array<Style> = [
		styles.textVariantMap[variant],
		styles.textSizeMap[size],
		...(color ? [{ color: resolvePdfColor(color, theme.colors) }] : []),
	];

	return (
		<View style={containerStyles}>
			<PDFText style={textStyles} wrap={false}>
				{text}
			</PDFText>
		</View>
	);
};
