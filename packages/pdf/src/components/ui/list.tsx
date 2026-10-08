import { Text as PDFText, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";
import { createListStyles } from "./list-styles";
import type { ListItem, ListVariant, ListProps } from "./list-types";

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
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createListStyles(theme), [theme]);
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
