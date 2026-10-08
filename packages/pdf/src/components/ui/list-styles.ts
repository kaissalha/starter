import { StyleSheet } from "@react-pdf/renderer";

import type { usePdfxTheme } from "../../lib/theme-context";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export const createListStyles = (t: PdfxTheme) => {
	const { borderRadius, fontWeights, spacing, typography } = t.primitives;

	return StyleSheet.create({
		checkBox: {
			alignItems: "center",
			backgroundColor: t.colors.background,
			borderColor: t.colors.border,
			borderRadius: 3,
			borderStyle: "solid",
			borderWidth: 1.5,
			height: spacing[4],
			justifyContent: "center",
			marginRight: spacing[2],
			width: spacing[4],
		},
		checkBoxChecked: { backgroundColor: t.colors.success, borderColor: t.colors.success },
		checkMark: {
			color: t.colors.background,
			fontFamily: t.typography.body.fontFamily,
			fontSize: 8,
			fontWeight: fontWeights.bold,
		},
		childrenContainer: { display: "flex", flexDirection: "column", marginLeft: spacing[5], marginTop: spacing[1] },
		container: { display: "flex", flexDirection: "column", marginBottom: t.spacing.componentGap, width: "100%" },
		descriptiveAccent: {
			backgroundColor: t.colors.primary,
			borderRadius: borderRadius.sm,
			marginRight: spacing[3],
			minHeight: spacing[4],
			width: 3,
		},
		descriptiveContent: { flex: 1 },
		descriptiveDesc: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.sm,
			lineHeight: t.typography.body.lineHeight,
			marginTop: 1,
		},
		descriptiveTitle: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			fontWeight: fontWeights.semibold,
			lineHeight: t.typography.body.lineHeight,
		},
		iconBox: {
			alignItems: "center",
			backgroundColor: t.colors.primary,
			borderRadius: borderRadius.md,
			height: spacing[5],
			justifyContent: "center",
			marginRight: spacing[2],
			width: spacing[5],
		},
		iconMark: {
			color: t.colors.primaryForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: 9,
			fontWeight: fontWeights.bold,
		},
		itemRow: { alignItems: "flex-start", flexDirection: "row" },
		itemRowCenter: { alignItems: "center", flexDirection: "row" },
		itemRowGapMd: { marginBottom: spacing[3] },
		itemRowGapSm: { marginBottom: spacing[2] },
		itemRowGapXs: { marginBottom: spacing[1] },
		itemText: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			lineHeight: t.typography.body.lineHeight,
		},
		itemTextBold: { fontWeight: fontWeights.semibold },
		itemTextSub: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize - 0.5,
			lineHeight: t.typography.body.lineHeight,
		},
		itemTextWrap: { flex: 1 },
		markerBulletDot: { backgroundColor: t.colors.primary, borderRadius: 3, height: 5, width: 5 },
		markerBulletSubDot: {
			backgroundColor: "transparent",
			borderColor: t.colors.mutedForeground,
			borderRadius: 2,
			borderStyle: "solid",
			borderWidth: 1,
			height: 4,
			width: 4,
		},
		markerBulletSubWrap: {
			alignItems: "center",
			justifyContent: "flex-start",
			marginTop: spacing[1],
			width: spacing[4],
		},
		markerBulletWrap: {
			alignItems: "center",
			justifyContent: "flex-start",
			marginTop: spacing[1],
			width: spacing[4],
		},
		markerNumberBadge: {
			alignItems: "center",
			backgroundColor: t.colors.primary,
			borderRadius: spacing[5],
			height: spacing[5],
			justifyContent: "center",
			marginRight: spacing[2],
			width: spacing[5],
		},
		markerNumberText: {
			color: t.colors.primaryForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.xs,
			fontWeight: fontWeights.bold,
		},
	});
};
