import { Text as PDFText, Rect, StyleSheet, Svg, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import QRCodeLib from "qrcode";

import { defaultTheme, resolvePdfColor, type PdfxTheme } from "../../lib/theme";

export type QRCodeErrorLevel = "L" | "M" | "Q" | "H";

export type QRCodeProps = {
	backgroundColor?: string;
	caption?: string;
	children?: never;
	color?: string;
	errorLevel?: QRCodeErrorLevel;
	margin?: number;
	size?: number;
	style?: Style;
	value: string;
};

const createQRCodeStyles = (t: PdfxTheme) => {
	const { spacing } = t.primitives;

	return StyleSheet.create({
		caption: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
			marginTop: spacing[1],
			textAlign: "center",
		},
		container: { alignItems: "center" },
	});
};

const generateQRMatrix = (value: string, errorLevel: QRCodeErrorLevel, margin: number): Array<Array<boolean>> => {
	const qr = QRCodeLib.create(value, { errorCorrectionLevel: errorLevel });
	const { data, size } = qr.modules;
	const totalSize = size + margin * 2;
	const matrix: Array<Array<boolean>> = [];

	for (const rowReference = { value: 0 }; rowReference.value < totalSize; rowReference.value++) {
		const rowData: Array<boolean> = [];

		for (const colReference = { value: 0 }; colReference.value < totalSize; colReference.value++) {
			const isInMargin =
				rowReference.value < margin ||
				rowReference.value >= size + margin ||
				colReference.value < margin ||
				colReference.value >= size + margin;

			rowData.push(
				isInMargin ? false : data[(rowReference.value - margin) * size + (colReference.value - margin)] === 1
			);
		}

		matrix.push(rowData);
	}

	return matrix;
};

export const QRCode = ({
	backgroundColor = "#ffffff",
	caption,
	color = "#000000",
	errorLevel = "M",
	margin = 2,
	size = 100,
	style,
	value,
}: QRCodeProps) => {
	const theme = defaultTheme;
	const styles = createQRCodeStyles(theme);
	const matrix = generateQRMatrix(value, errorLevel, margin);
	const moduleSize = size / matrix.length;
	const resolvedColor = resolvePdfColor(color, theme.colors);

	const resolvedBgColor =
		backgroundColor === "transparent" ? undefined : resolvePdfColor(backgroundColor, theme.colors);

	const containerStyles: Array<Style> = [styles.container];

	if (style) {
		containerStyles.push(...[style].flat());
	}

	return (
		<View style={containerStyles}>
			<Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
				{resolvedBgColor !== undefined && (
					<Rect fill={resolvedBgColor} height={size} width={size} x={0} y={0} />
				)}
				{matrix.flatMap((row, y) =>
					row.flatMap((isDark, x) =>
						isDark
							? [
									<Rect
										fill={resolvedColor}
										height={moduleSize}
										key={`qr-${y}-${x}`}
										width={moduleSize}
										x={x * moduleSize}
										y={y * moduleSize}
									/>,
								]
							: []
					)
				)}
			</Svg>
			{caption && <PDFText style={styles.caption}>{caption}</PDFText>}
		</View>
	);
};
