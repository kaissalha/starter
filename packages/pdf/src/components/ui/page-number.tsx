import { Text as PDFText, StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, type PdfxTheme } from "../../lib/theme";

export type PageNumberAlign = "left" | "center" | "right";

export type PageNumberSize = "xs" | "sm" | "md";

export type PageNumberProps = {
	align?: PageNumberAlign;
	children?: never;
	fixed?: boolean;
	format?: string;
	muted?: boolean;
	size?: PageNumberSize;
	style?: Style;
};

const createPageNumberStyles = (t: PdfxTheme) => {
	const { colors, primitives, typography } = t;

	return StyleSheet.create({
		alignCenter: { textAlign: "center" },
		alignLeft: { textAlign: "left" },
		alignRight: { textAlign: "right" },
		colorForeground: { color: colors.foreground },
		colorMuted: { color: colors.mutedForeground },
		container: { width: "100%" },
		sizeMd: { fontSize: primitives.typography.base },
		sizeSm: { fontSize: primitives.typography.sm },
		sizeXs: { fontSize: primitives.typography.xs },
		text: { fontFamily: typography.body.fontFamily },
	});
};

const formatPageNumber = (format: string, pageNumber: number, totalPages: number): string =>
	format.replace("{page}", String(pageNumber)).replace("{total}", String(totalPages));

export const PageNumber = ({
	align = "center",
	fixed = false,
	format = "Page {page} of {total}",
	muted = true,
	size = "sm",
	style,
}: PageNumberProps) => {
	const theme = defaultTheme;
	const styles = createPageNumberStyles(theme);

	const alignMap = {
		center: styles.alignCenter,
		left: styles.alignLeft,
		right: styles.alignRight,
	} satisfies Record<PageNumberAlign, Style>;

	const sizeMap = { md: styles.sizeMd, sm: styles.sizeSm, xs: styles.sizeXs } satisfies Record<PageNumberSize, Style>;

	const textStyles: Array<Style> = [
		styles.text,
		alignMap[align],
		sizeMap[size],
		muted ? styles.colorMuted : styles.colorForeground,
	];

	if (style) {
		textStyles.push(...[style].flat());
	}

	return (
		<View fixed={fixed} style={styles.container}>
			<PDFText
				render={({ pageNumber, totalPages }) => formatPageNumber(format, pageNumber, totalPages)}
				style={textStyles}
			/>
		</View>
	);
};
