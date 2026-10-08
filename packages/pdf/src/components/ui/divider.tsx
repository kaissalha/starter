import { Text as PDFText, StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";
import { resolvePdfColor } from "./utils/color";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export type DividerVariant = "solid" | "dashed" | "dotted";

export type DividerThickness = "thin" | "medium" | "thick";

export type DividerSpacing = "none" | "sm" | "md" | "lg";

export type DividerProps = {
	color?: string;
	label?: string;
	spacing?: DividerSpacing;
	style?: Style;
	thickness?: DividerThickness;
	variant?: DividerVariant;
	width?: string | number;
};

const createDividerStyles = (t: PdfxTheme) => {
	const { fontWeights, spacing } = t.primitives;

	return StyleSheet.create({
		base: { borderBottomColor: t.colors.border, borderBottomStyle: "solid" },
		dashed: { borderBottomStyle: "dashed" },
		dotted: { borderBottomStyle: "dotted" },
		labelContainer: { alignItems: "center", flexDirection: "row" },
		labelLine: { borderBottomColor: t.colors.border, borderBottomStyle: "solid", flex: 1 },
		labelText: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
			fontWeight: fontWeights.medium,
			letterSpacing: t.primitives.letterSpacing.wider * 10,
			paddingHorizontal: spacing[3],
			textTransform: "uppercase",
		},
		medium: { borderBottomWidth: spacing[1] },
		solid: { borderBottomStyle: "solid" },
		spacingLg: { marginVertical: t.spacing.sectionGap },
		spacingMd: { marginVertical: t.spacing.componentGap },
		spacingNone: { marginVertical: spacing[0] },
		spacingSm: { marginVertical: t.spacing.paragraphGap },
		thick: { borderBottomWidth: spacing[2] },
		thin: { borderBottomWidth: spacing[0.5] },
	});
};

export const Divider = ({
	color,
	label,
	spacing = "md",
	style,
	thickness = "thin",
	variant = "solid",
	width,
}: DividerProps) => {
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createDividerStyles(theme), [theme]);
	const spacingMap = { lg: styles.spacingLg, md: styles.spacingMd, none: styles.spacingNone, sm: styles.spacingSm };
	const variantMap = { dashed: styles.dashed, dotted: styles.dotted, solid: styles.solid };
	const thicknessMap = { medium: styles.medium, thick: styles.thick, thin: styles.thin };

	if (label) {
		const lineStyle: Array<Style> = [styles.labelLine, thicknessMap[thickness], variantMap[variant]];

		if (color) {
			lineStyle.push({ borderBottomColor: resolvePdfColor(color, theme.colors) });
		}

		const containerStyles: Array<Style> = [styles.labelContainer, spacingMap[spacing]];

		if (width !== undefined) {
			containerStyles.push({ width });
		}

		if (style) {
			containerStyles.push(...[style].flat());
		}

		const labelTextStyle: Array<Style> = [styles.labelText];

		if (color) {
			labelTextStyle.push({ color: resolvePdfColor(color, theme.colors) });
		}

		return (
			<View style={containerStyles}>
				<View style={lineStyle} />
				<PDFText style={labelTextStyle}>{label}</PDFText>
				<View style={lineStyle} />
			</View>
		);
	}

	const styleArray: Array<Style> = [styles.base, spacingMap[spacing], variantMap[variant], thicknessMap[thickness]];

	if (color) {
		styleArray.push({ borderBottomColor: resolvePdfColor(color, theme.colors) });
	}

	if (width !== undefined) {
		styleArray.push({ width });
	}

	if (style) {
		styleArray.push(...[style].flat());
	}

	return <View style={styleArray} />;
};
