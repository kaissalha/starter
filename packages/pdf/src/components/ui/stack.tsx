import type React from "react";

import { StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, type PdfxTheme } from "../../lib/theme";

export type StackGap = "none" | "sm" | "md" | "lg" | "xl";

export type StackDirection = "vertical" | "horizontal";

export type StackAlign = "start" | "center" | "end" | "stretch";

export type StackJustify = "start" | "center" | "end" | "between" | "around";

export type StackProps = {
	align?: StackAlign;
	children: React.ReactNode;
	direction?: StackDirection;
	gap?: StackGap;
	justify?: StackJustify;
	noWrap?: boolean;
	style?: Style;
	wrap?: boolean;
};

const createStackStyles = (t: PdfxTheme) => {
	const { spacing } = t.primitives;

	return StyleSheet.create({
		alignCenter: { alignItems: "center" },
		alignEnd: { alignItems: "flex-end" },
		alignStart: { alignItems: "flex-start" },
		alignStretch: { alignItems: "stretch" },
		gapLg: { gap: spacing[6] },
		gapMd: { gap: spacing[4] },
		gapNone: { gap: spacing[0] },
		gapSm: { gap: spacing[2] },
		gapXl: { gap: spacing[8] },
		horizontal: { flexDirection: "row" },
		justifyAround: { justifyContent: "space-around" },
		justifyBetween: { justifyContent: "space-between" },
		justifyCenter: { justifyContent: "center" },
		justifyEnd: { justifyContent: "flex-end" },
		justifyStart: { justifyContent: "flex-start" },
		vertical: { flexDirection: "column" },
		wrap: { flexWrap: "wrap" },
	});
};

export const Stack = ({
	align,
	children,
	direction = "vertical",
	gap = "md",
	justify,
	noWrap,
	style,
	wrap,
}: StackProps) => {
	const theme = defaultTheme;
	const styles = createStackStyles(theme);
	const gapMap = { lg: styles.gapLg, md: styles.gapMd, none: styles.gapNone, sm: styles.gapSm, xl: styles.gapXl };

	const alignMap = {
		center: styles.alignCenter,
		end: styles.alignEnd,
		start: styles.alignStart,
		stretch: styles.alignStretch,
	};

	const justifyMap = {
		around: styles.justifyAround,
		between: styles.justifyBetween,
		center: styles.justifyCenter,
		end: styles.justifyEnd,
		start: styles.justifyStart,
	};

	const styleArray: Array<Style> = [direction === "horizontal" ? styles.horizontal : styles.vertical, gapMap[gap]];

	if (align) {
		styleArray.push(alignMap[align]);
	}

	if (justify) {
		styleArray.push(justifyMap[justify]);
	}

	if (wrap) {
		styleArray.push(styles.wrap);
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
