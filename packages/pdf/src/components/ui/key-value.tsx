import { Text as PDFText, StyleSheet, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, resolvePdfColor, type PdfxTheme } from "../../lib/theme";

export type KeyValueDirection = "horizontal" | "vertical";

export type KeyValueSize = "sm" | "md" | "lg";

export type KeyValueEntry = {
	key: string;
	keyStyle?: Style;
	value: string;
	valueColor?: string;
	valueStyle?: Style;
};

export type KeyValueProps = {
	boldValue?: boolean;
	direction?: KeyValueDirection;
	divided?: boolean;
	dividerColor?: string;
	dividerMargin?: number;
	dividerThickness?: number;
	items: Array<KeyValueEntry>;
	labelColor?: string;
	labelFlex?: number;
	noWrap?: boolean;
	size?: KeyValueSize;
	style?: Style;
	valueColor?: string;
};

const createKeyValueStyles = (t: PdfxTheme) => {
	const { fontWeights, spacing } = t.primitives;
	const c = t.colors;
	const { body } = t.typography;
	const keyBase = { color: c.mutedForeground, fontFamily: body.fontFamily, fontWeight: fontWeights.medium };
	const valueBase = { color: c.foreground, fontFamily: body.fontFamily, fontWeight: fontWeights.regular };

	return StyleSheet.create({
		container: { flexDirection: "column" },
		divider: { borderBottomColor: c.border, borderBottomStyle: "solid", borderBottomWidth: spacing[0.5] },
		keyLg: { ...keyBase, fontSize: t.primitives.typography.base },
		keyMd: { ...keyBase, fontSize: body.fontSize },
		keySm: { ...keyBase, fontSize: t.primitives.typography.xs },
		rowHorizontal: { alignItems: "flex-start", flexDirection: "row", paddingVertical: spacing[1] },
		rowVertical: { flexDirection: "column", marginBottom: t.spacing.paragraphGap },
		valueBold: { fontWeight: fontWeights.bold },
		valueLg: { ...valueBase, fontSize: t.primitives.typography.base },
		valueMd: { ...valueBase, fontSize: body.fontSize },
		valueSm: { ...valueBase, fontSize: t.primitives.typography.xs },
	});
};

export const KeyValue = ({
	boldValue = false,
	direction = "horizontal",
	divided = false,
	dividerColor,
	dividerMargin,
	dividerThickness,
	items,
	labelColor,
	labelFlex = 1,
	noWrap = false,
	size = "md",
	style,
	valueColor,
}: KeyValueProps) => {
	const theme = defaultTheme;
	const styles = createKeyValueStyles(theme);
	const keyStyleMap = { lg: styles.keyLg, md: styles.keyMd, sm: styles.keySm } satisfies Record<KeyValueSize, Style>;

	const valueStyleMap = { lg: styles.valueLg, md: styles.valueMd, sm: styles.valueSm } satisfies Record<
		KeyValueSize,
		Style
	>;

	const containerStyles: Array<Style> = [styles.container];

	if (style) {
		containerStyles.push(...[style].flat());
	}

	return (
		<View style={containerStyles} wrap={!noWrap}>
			{items.map((item, index) => {
				const isLast = index === items.length - 1;
				const keyStyles: Array<Style> = [keyStyleMap[size]];

				if (labelColor) {
					keyStyles.push({ color: resolvePdfColor(labelColor, theme.colors) });
				}

				if (item.keyStyle) {
					keyStyles.push(item.keyStyle);
				}

				const valStyles: Array<Style> = [valueStyleMap[size]];

				if (boldValue) {
					valStyles.push(styles.valueBold);
				}

				const resolvedValueColor = item.valueColor ?? valueColor;

				if (resolvedValueColor) {
					valStyles.push({ color: resolvePdfColor(resolvedValueColor, theme.colors) });
				}

				if (item.valueStyle) {
					valStyles.push(item.valueStyle);
				}

				if (direction === "horizontal") {
					const rowStyles: Array<Style> = [styles.rowHorizontal];

					if (divided && !isLast) {
						const dividerStyle: Style = {};

						if (dividerColor) {
							dividerStyle.borderBottomColor = resolvePdfColor(dividerColor, theme.colors);
						}

						if (dividerThickness) {
							dividerStyle.borderBottomWidth = dividerThickness;
						}

						if (dividerMargin) {
							dividerStyle.marginBottom = dividerMargin;
						}

						rowStyles.push({ ...styles.divider, ...dividerStyle });
					}

					return (
						<View key={item.key} style={rowStyles}>
							<PDFText style={[...keyStyles, { flex: labelFlex }]}>{item.key}</PDFText>
							<PDFText style={[...valStyles, { flex: 1, textAlign: "right" }]}>{item.value}</PDFText>
						</View>
					);
				}

				const rowStyles: Array<Style> = [styles.rowVertical];

				if (divided && !isLast) {
					rowStyles.push(styles.divider);
				}

				return (
					<View key={item.key} style={rowStyles}>
						<PDFText style={keyStyles}>{item.key}</PDFText>
						<PDFText style={valStyles}>{item.value}</PDFText>
					</View>
				);
			})}
		</View>
	);
};
