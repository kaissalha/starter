import type { ReactNode } from "react";

import { Text as PDFText, StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export type CardVariant = "default" | "bordered" | "muted";

export type CardProps = {
	children?: ReactNode;
	padding?: "sm" | "md" | "lg";
	style?: Style;
	title?: string;
	variant?: CardVariant;
	wrap?: boolean;
};

const createCardStyles = (t: PdfxTheme) => {
	const { borderRadius, fontWeights, spacing } = t.primitives;

	return StyleSheet.create({
		body: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			lineHeight: t.typography.body.lineHeight,
		},
		card: {
			backgroundColor: t.colors.background,
			borderColor: t.colors.border,
			borderRadius: borderRadius.sm,
			borderStyle: "solid",
			borderWidth: 1,
			marginBottom: t.spacing.componentGap,
		},
		cardBordered: { borderWidth: 2 },
		cardMuted: { backgroundColor: t.colors.muted },
		paddingLg: { padding: spacing[4] },
		paddingMd: { padding: spacing[3] },
		paddingSm: { padding: spacing[2] },
		title: {
			borderBottomColor: t.colors.border,
			borderBottomStyle: "solid",
			borderBottomWidth: 1,
			color: t.colors.foreground,
			fontFamily: t.typography.heading.fontFamily,
			fontSize: t.primitives.typography.base,
			fontWeight: fontWeights.semibold,
			lineHeight: t.typography.heading.lineHeight,
			marginBottom: spacing[2],
			paddingBottom: spacing[1] + 2,
		},
	});
};

export const Card = ({ children, padding = "md", style, title, variant = "default", wrap = false }: CardProps) => {
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createCardStyles(theme), [theme]);
	const paddingMap = { lg: styles.paddingLg, md: styles.paddingMd, sm: styles.paddingSm };
	const cardStyles: Array<Style> = [styles.card];

	if (variant === "bordered") {
		cardStyles.push(styles.cardBordered);
	}

	if (variant === "muted") {
		cardStyles.push(styles.cardMuted);
	}

	cardStyles.push(paddingMap[padding]);

	if (style) {
		cardStyles.push(style);
	}

	return (
		<View style={cardStyles} wrap={wrap}>
			{title ? <PDFText style={styles.title}>{title}</PDFText> : null}
			{Object.prototype.toString.call(children) === "[object String]" ? (
				<PDFText style={styles.body}>{String(children)}</PDFText>
			) : (
				children
			)}
		</View>
	);
};
