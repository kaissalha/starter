import { StyleSheet, Text as PDFText, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, type PdfxTheme } from "../../lib/theme";

export type ListVariant = "bullet" | "numbered" | "checklist" | "icon" | "multi-level" | "descriptive";

export type ListItem = {
	checked?: boolean;
	children?: Array<ListItem>;
	description?: string;
	text: string;
};

export type ListProps = {
	_level?: number;
	gap?: "xs" | "sm" | "md";
	items: Array<ListItem>;
	noWrap?: boolean;
	style?: Style;
	variant?: ListVariant;
};

const createListStyles = (t: PdfxTheme) => {
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

type Styles = ReturnType<typeof createListStyles>;

type GapProp = "xs" | "sm" | "md";

const getGapStyle = (gap: GapProp, styles: Styles): Style => {
	if (gap === "xs") {
		return styles.itemRowGapXs;
	}

	if (gap === "md") {
		return styles.itemRowGapMd;
	}

	return styles.itemRowGapSm;
};

const buildRowStyles = (
	index: number,
	total: number,
	gap: GapProp,
	styles: Styles,
	align: "start" | "center" = "start"
): Array<Style> => {
	const row: Array<Style> = [align === "center" ? styles.itemRowCenter : styles.itemRow];

	if (index !== total - 1) {
		row.push(getGapStyle(gap, styles));
	}

	return row;
};

const dotMarker = (level: number, styles: Styles): React.ReactElement =>
	level === 0 ? (
		<View style={styles.markerBulletWrap}>
			<View style={styles.markerBulletDot} />
		</View>
	) : (
		<View style={styles.markerBulletSubWrap}>
			<View style={styles.markerBulletSubDot} />
		</View>
	);

const renderItemList = (
	items: Array<ListItem>,
	variant: ListVariant,
	gap: GapProp,
	styles: Styles,
	level: number
): React.ReactElement => (
	<View style={level > 0 ? styles.childrenContainer : undefined}>
		{items.map((item, index) => renderItem({ gap, index, item, level, styles, total: items.length, variant }))}
	</View>
);

const renderBulletItem = ({
	gap,
	index,
	item,
	level,
	styles,
	total,
}: {
	gap: GapProp;
	index: number;
	item: ListItem;
	level: number;
	styles: Styles;
	total: number;
}): React.ReactElement => (
	<View key={index}>
		<View style={buildRowStyles(index, total, gap, styles)}>
			{dotMarker(level, styles)}
			<View style={styles.itemTextWrap}>
				<PDFText style={styles.itemText}>{item.text}</PDFText>
			</View>
		</View>
		{item.children && item.children.length > 0
			? renderItemList(item.children, "bullet", gap, styles, level + 1)
			: null}
	</View>
);

const renderNumberedItem = (
	item: ListItem,
	index: number,
	total: number,
	gap: GapProp,
	styles: Styles
): React.ReactElement => (
	<View key={index} style={buildRowStyles(index, total, gap, styles, "center")}>
		<View style={styles.markerNumberBadge}>
			<PDFText style={styles.markerNumberText}>{`${index + 1}`}</PDFText>
		</View>
		<View style={styles.itemTextWrap}>
			<PDFText style={styles.itemText}>{item.text}</PDFText>
		</View>
	</View>
);

const renderChecklistItem = (
	item: ListItem,
	index: number,
	total: number,
	gap: GapProp,
	styles: Styles
): React.ReactElement => {
	const isChecked = item.checked ?? true;

	return (
		<View key={index} style={buildRowStyles(index, total, gap, styles, "center")}>
			<View style={[styles.checkBox, isChecked ? styles.checkBoxChecked : {}]}>
				{isChecked ? <PDFText style={styles.checkMark}>✓</PDFText> : null}
			</View>
			<View style={styles.itemTextWrap}>
				<PDFText style={styles.itemText}>{item.text}</PDFText>
			</View>
		</View>
	);
};

const renderIconItem = (
	item: ListItem,
	index: number,
	total: number,
	gap: GapProp,
	styles: Styles
): React.ReactElement => (
	<View key={index} style={buildRowStyles(index, total, gap, styles, "center")}>
		<View style={styles.iconBox}>
			<PDFText style={styles.iconMark}>★</PDFText>
		</View>
		<View style={styles.itemTextWrap}>
			<PDFText style={styles.itemText}>{item.text}</PDFText>
		</View>
	</View>
);

const renderMultiLevelItem = ({
	gap,
	index,
	item,
	level,
	styles,
	total,
}: {
	gap: GapProp;
	index: number;
	item: ListItem;
	level: number;
	styles: Styles;
	total: number;
}): React.ReactElement => (
	<View key={index}>
		<View style={buildRowStyles(index, total, gap, styles)}>
			{dotMarker(level, styles)}
			<View style={styles.itemTextWrap}>
				<PDFText
					style={[level === 0 ? styles.itemText : styles.itemTextSub, level === 0 ? styles.itemTextBold : {}]}
				>
					{item.text}
				</PDFText>
			</View>
		</View>
		{item.children && item.children.length > 0
			? renderItemList(item.children, "multi-level", gap, styles, level + 1)
			: null}
	</View>
);

const renderDescriptiveItem = (
	item: ListItem,
	index: number,
	total: number,
	gap: GapProp,
	styles: Styles
): React.ReactElement => (
	<View key={index} style={buildRowStyles(index, total, gap, styles)}>
		<View style={styles.descriptiveAccent} />
		<View style={styles.descriptiveContent}>
			<PDFText style={styles.descriptiveTitle}>{item.text}</PDFText>
			{item.description ? <PDFText style={styles.descriptiveDesc}>{item.description}</PDFText> : null}
		</View>
	</View>
);

const renderItem = ({
	gap,
	index,
	item,
	level,
	styles,
	total,
	variant,
}: {
	gap: GapProp;
	index: number;
	item: ListItem;
	level: number;
	styles: Styles;
	total: number;
	variant: ListVariant;
}): React.ReactElement | null => {
	switch (variant) {
		case "bullet":
			return renderBulletItem({ gap, index, item, level, styles, total });
		case "numbered":
			return renderNumberedItem(item, index, total, gap, styles);
		case "checklist":
			return renderChecklistItem(item, index, total, gap, styles);
		case "icon":
			return renderIconItem(item, index, total, gap, styles);
		case "multi-level":
			return renderMultiLevelItem({ gap, index, item, level, styles, total });
		case "descriptive":
			return renderDescriptiveItem(item, index, total, gap, styles);
	}
};

export const List = ({ _level = 0, gap = "sm", items, noWrap = false, style, variant = "bullet" }: ListProps) => {
	const theme = defaultTheme;
	const styles = createListStyles(theme);
	const containerStyles: Array<Style> = [styles.container];

	if (_level > 0) {
		containerStyles.push(styles.childrenContainer);
	}

	const styleArray = style ? [...containerStyles, style] : containerStyles;

	return (
		<View style={styleArray} wrap={!noWrap}>
			{items.map((item, index) =>
				renderItem({ gap, index, item, level: _level, styles, total: items.length, variant })
			)}
		</View>
	);
};
