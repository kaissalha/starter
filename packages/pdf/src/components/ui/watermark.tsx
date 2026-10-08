import { Text as PDFText, StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";
import { resolvePdfColor } from "./utils/color";

type PdfxTheme = ReturnType<typeof usePdfxTheme>;

export type WatermarkPosition = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type WatermarkProps = {
	angle?: number;
	children?: never;
	color?: string;
	fixed?: boolean;
	fontSize?: number;
	opacity?: number;
	position?: WatermarkPosition;
	style?: Style;
	text: string;
};

const createWatermarkStyles = (t: PdfxTheme) => {
	const { fontWeights } = t.primitives;
	const { marginBottom, marginLeft, marginRight, marginTop } = t.spacing.page;

	return StyleSheet.create({
		container: {
			alignItems: "center",
			bottom: 0,
			justifyContent: "center",
			left: 0,
			pointerEvents: "none",
			position: "absolute",
			right: 0,
			top: 0,
			zIndex: -1,
		},
		positionBottomLeft: {
			alignItems: "flex-start",
			justifyContent: "flex-end",
			paddingBottom: marginBottom,
			paddingLeft: marginLeft,
		},
		positionBottomRight: {
			alignItems: "flex-end",
			justifyContent: "flex-end",
			paddingBottom: marginBottom,
			paddingRight: marginRight,
		},
		positionCenter: { alignItems: "center", justifyContent: "center" },
		positionTopLeft: {
			alignItems: "flex-start",
			justifyContent: "flex-start",
			paddingLeft: marginLeft,
			paddingTop: marginTop,
		},
		positionTopRight: {
			alignItems: "flex-end",
			justifyContent: "flex-start",
			paddingRight: marginRight,
			paddingTop: marginTop,
		},
		text: {
			fontFamily: t.typography.heading.fontFamily,
			fontWeight: fontWeights.bold,
			letterSpacing: 4,
			textTransform: "uppercase",
		},
	});
};

export const Watermark = ({
	angle = -45,
	color = "mutedForeground",
	fixed = true,
	fontSize = 60,
	opacity = 0.15,
	position = "center",
	style,
	text,
}: WatermarkProps) => {
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createWatermarkStyles(theme), [theme]);

	const positionMap = {
		"bottom-left": styles.positionBottomLeft,
		"bottom-right": styles.positionBottomRight,
		center: styles.positionCenter,
		"top-left": styles.positionTopLeft,
		"top-right": styles.positionTopRight,
	} satisfies Record<WatermarkPosition, Style>;

	const containerStyles: Array<Style> = [styles.container, positionMap[position]];

	if (style) {
		containerStyles.push(...[style].flat());
	}

	const textStyles: Array<Style> = [
		styles.text,
		{ color: resolvePdfColor(color, theme.colors), fontSize, opacity, transform: `rotate(${angle}deg)` },
	];

	return (
		<View fixed={fixed} style={containerStyles}>
			<PDFText style={textStyles}>{text}</PDFText>
		</View>
	);
};
