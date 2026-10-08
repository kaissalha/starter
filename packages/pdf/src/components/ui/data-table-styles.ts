import { StyleSheet } from "@react-pdf/renderer";

import type { usePdfxTheme } from "../../lib/theme-context";
import type { DataTableValue } from "./data-table-types";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export const createCompactStyles = (t: PdfxTheme) => {
	const { fontWeights, lineHeights, spacing } = t.primitives;

	return StyleSheet.create({
		cell: { paddingHorizontal: spacing[2], paddingVertical: spacing[0.5] },
		footerText: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
			fontWeight: fontWeights.semibold,
			lineHeight: lineHeights.normal,
		},
		headerText: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
			fontWeight: fontWeights.semibold,
			lineHeight: lineHeights.normal,
		},
		text: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
			lineHeight: lineHeights.normal,
		},
	});
};

export const formatValue = (value: DataTableValue): string => {
	if (value === null || value === undefined) {
		return "";
	}

	return String(value);
};
