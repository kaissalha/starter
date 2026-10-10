import { Children, type ReactNode, cloneElement, isValidElement } from "react";

import { StyleSheet, Text as PDFText, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, type PdfxTheme } from "../../lib/theme";

export type TableVariant = "line" | "grid" | "minimal" | "striped" | "compact" | "bordered" | "primary-header";

export type TableProps = {
	children: ReactNode;
	noWrap?: boolean;
	style?: Style;
	variant?: TableVariant;
	zebraStripe?: boolean;
};

export type TableSectionProps = {
	children: ReactNode;
	style?: Style;
};

export type TableRowProps = {
	children: ReactNode;
	footer?: boolean;
	header?: boolean;
	stripe?: boolean;
	style?: Style;
	variant?: TableVariant;
};

export type TableCellProps = {
	_last?: boolean;
	align?: "left" | "center" | "right";
	children: ReactNode;
	footer?: boolean;
	header?: boolean;
	style?: Style;
	variant?: TableVariant;
	width?: string | number;
};

const createTableStyles = (t: PdfxTheme) => {
	const { borderRadius, fontWeights, spacing, typography } = t.primitives;
	const borderColor = t.colors.border;
	const hairline = 0.5;
	const rule = 1;
	const thick = 1.5;
	const cellPadV = spacing[2] - 2;
	const cellPadH = spacing[2] + 2;
	const cellPadVCompact = spacing[0.5];
	const cellPadHCompact = spacing[2];

	const rowDivider = {
		borderBottomColor: borderColor,
		borderBottomStyle: "solid" as const,
		borderBottomWidth: hairline,
	};

	return StyleSheet.create({
		cell: { flex: 1, justifyContent: "center", paddingHorizontal: cellPadH, paddingVertical: cellPadV },
		cellBordered: { paddingHorizontal: cellPadH, paddingVertical: cellPadV },
		cellBorderedBorder: { borderRightColor: borderColor, borderRightStyle: "solid", borderRightWidth: hairline },
		cellCompact: { paddingHorizontal: cellPadHCompact, paddingVertical: cellPadVCompact },
		cellFixed: {
			flexGrow: 0,
			flexShrink: 0,
			justifyContent: "center",
			paddingHorizontal: cellPadH,
			paddingVertical: cellPadV,
		},
		cellGridBorder: { borderRightColor: borderColor, borderRightStyle: "solid", borderRightWidth: hairline },
		cellMinimal: { paddingHorizontal: spacing[2] - 2, paddingVertical: spacing[1] + 1 },
		cellPrimaryHeader: { paddingHorizontal: cellPadH, paddingVertical: cellPadV },
		cellStriped: { paddingHorizontal: cellPadH, paddingVertical: cellPadV },
		cellText: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			lineHeight: 1.2,
		},
		cellTextCompact: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.xs,
			lineHeight: 1.2,
		},
		cellTextFooter: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			fontWeight: fontWeights.semibold,
			lineHeight: 1.2,
		},
		cellTextHeaderBordered: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			fontWeight: fontWeights.bold,
			lineHeight: 1.2,
		},
		cellTextHeaderCompact: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.xs,
			fontWeight: fontWeights.semibold,
			letterSpacing: 0.6,
			lineHeight: 1.2,
			textTransform: "uppercase",
		},
		cellTextHeaderGrid: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			fontWeight: fontWeights.semibold,
			lineHeight: 1.2,
		},
		cellTextHeaderLine: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			fontWeight: fontWeights.semibold,
			lineHeight: 1.2,
		},
		cellTextHeaderMinimal: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			fontWeight: fontWeights.medium,
			lineHeight: 1.2,
		},
		cellTextHeaderPrimaryHeader: {
			color: t.colors.primaryForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: typography.xs,
			fontWeight: fontWeights.semibold,
			letterSpacing: 0.6,
			lineHeight: 1.2,
			textTransform: "uppercase",
		},
		cellTextHeaderStriped: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.typography.body.fontSize,
			fontWeight: fontWeights.semibold,
			lineHeight: 1.2,
		},
		row: { display: "flex", flexDirection: "row" },
		rowBordered: rowDivider,
		rowCompact: rowDivider,
		rowFooter: { borderTopColor: borderColor, borderTopStyle: "solid", borderTopWidth: rule },
		rowFooterStriped: {
			backgroundColor: t.colors.muted,
			borderTopColor: borderColor,
			borderTopStyle: "solid",
			borderTopWidth: rule,
		},
		rowGrid: rowDivider,
		rowHeaderBordered: {
			backgroundColor: t.colors.muted,
			borderBottomColor: borderColor,
			borderBottomStyle: "solid",
			borderBottomWidth: hairline,
		},
		rowHeaderCompact: {
			backgroundColor: t.colors.muted,
			borderBottomColor: borderColor,
			borderBottomStyle: "solid",
			borderBottomWidth: rule,
		},
		rowHeaderGrid: {
			backgroundColor: t.colors.muted,
			borderBottomColor: borderColor,
			borderBottomStyle: "solid",
			borderBottomWidth: rule,
		},
		rowHeaderLine: { borderBottomColor: borderColor, borderBottomStyle: "solid", borderBottomWidth: rule },
		rowHeaderMinimal: { borderBottomColor: borderColor, borderBottomStyle: "solid", borderBottomWidth: rule },
		rowHeaderPrimaryHeader: { backgroundColor: t.colors.primary },
		rowHeaderStriped: {
			backgroundColor: t.colors.muted,
			borderBottomColor: borderColor,
			borderBottomStyle: "solid",
			borderBottomWidth: rule,
		},
		rowLine: rowDivider,
		rowMinimal: rowDivider,
		rowPrimaryHeader: rowDivider,
		rowStripe: { backgroundColor: t.colors.muted },
		rowStriped: {},
		table: { display: "flex", flexDirection: "column", marginBottom: t.spacing.componentGap, width: "100%" },
		tableBordered: {
			borderBottomLeftRadius: borderRadius.sm,
			borderBottomRightRadius: borderRadius.sm,
			borderColor,
			borderStyle: "solid",
			borderTopLeftRadius: borderRadius.sm,
			borderTopRightRadius: borderRadius.sm,
			borderWidth: rule,
			overflow: "hidden" as const,
		},
		tableCompact: { borderBottomColor: borderColor, borderBottomStyle: "solid", borderBottomWidth: hairline },
		tableGrid: {
			borderBottomLeftRadius: borderRadius.md,
			borderBottomRightRadius: borderRadius.md,
			borderColor,
			borderStyle: "solid",
			borderTopLeftRadius: borderRadius.md,
			borderTopRightRadius: borderRadius.md,
			borderWidth: thick,
			overflow: "hidden" as const,
		},
		tableLine: { borderBottomColor: borderColor, borderBottomStyle: "solid", borderBottomWidth: hairline },
		tableMinimal: { paddingVertical: spacing[2] },
		tablePrimaryHeader: { borderBottomColor: borderColor, borderBottomStyle: "solid", borderBottomWidth: hairline },
		tableStriped: {
			borderBottomColor: borderColor,
			borderBottomStyle: "solid",
			borderBottomWidth: hairline,
			borderTopColor: borderColor,
			borderTopStyle: "solid",
			borderTopWidth: hairline,
		},
	});
};

type MutableReference<Value> = { value: Value };

const processTableChildren = (children: ReactNode, variant: TableVariant, zebraStripe: boolean): ReactNode => {
	const bodyRowIndexReference = { value: 0 };

	return Children.map(children, (child) => {
		if (!isValidElement<TableSectionProps>(child)) {
			return child;
		}

		if (child.type === TableHeader || child.type === TableBody || child.type === TableFooter) {
			const isBody = child.type === TableBody;

			const sectionChildren = Children.map(child.props.children, (rowChild) => {
				if (isValidElement<TableRowProps>(rowChild) && rowChild.type === TableRow) {
					const rowProps: Partial<TableRowProps> = { variant };

					if (isBody && zebraStripe) {
						const isStripe = bodyRowIndexReference.value % 2 === 1;
						bodyRowIndexReference.value++;

						if (isStripe) {
							rowProps.stripe = true;
						}
					}

					return cloneElement(rowChild, rowProps);
				}

				return rowChild;
			});

			return cloneElement(child, {}, sectionChildren);
		}

		if (isValidElement<TableRowProps>(child) && child.type === TableRow) {
			return cloneElement(child, { variant });
		}

		return child;
	});
};

export const TableHeader = ({ children, style }: TableSectionProps) => (
	<View minPresenceAhead={60} style={style}>
		{children}
	</View>
);

export const TableBody = ({ children, style }: TableSectionProps) => <View style={style}>{children}</View>;

export const TableFooter = ({ children, style }: TableSectionProps) => <View style={style}>{children}</View>;

export const Table = ({ children, noWrap = false, style, variant = "line", zebraStripe = false }: TableProps) => {
	const theme = defaultTheme;
	const styles = createTableStyles(theme);
	const tableStyles: Array<Style> = [styles.table];
	const effectiveZebra = variant === "striped" ? true : zebraStripe;

	tableStyles.push(
		{
			bordered: styles.tableBordered,
			compact: styles.tableCompact,
			grid: styles.tableGrid,
			line: styles.tableLine,
			minimal: styles.tableMinimal,
			"primary-header": styles.tablePrimaryHeader,
			striped: styles.tableStriped,
		}[variant]
	);

	const styleArray = style ? [...tableStyles, style] : tableStyles;
	const processedChildren = processTableChildren(children, variant, effectiveZebra);
	const inner = <View style={styleArray}>{processedChildren}</View>;

	return noWrap ? <View wrap={false}>{inner}</View> : inner;
};

export const TableRow = ({ children, footer, header, stripe, style, variant = "line" }: TableRowProps) => {
	const theme = defaultTheme;
	const styles = createTableStyles(theme);
	const rowStyles: Array<Style> = [styles.row];

	rowStyles.push(
		{
			bordered: styles.rowBordered,
			compact: styles.rowCompact,
			grid: styles.rowGrid,
			line: styles.rowLine,
			minimal: styles.rowMinimal,
			"primary-header": styles.rowPrimaryHeader,
			striped: styles.rowStriped,
		}[variant]
	);

	if (header) {
		rowStyles.push(
			{
				bordered: styles.rowHeaderBordered,
				compact: styles.rowHeaderCompact,
				grid: styles.rowHeaderGrid,
				line: styles.rowHeaderLine,
				minimal: styles.rowHeaderMinimal,
				"primary-header": styles.rowHeaderPrimaryHeader,
				striped: styles.rowHeaderStriped,
			}[variant]
		);
	}

	if (footer) {
		if (variant === "striped") {
			rowStyles.push(styles.rowFooterStriped);
		} else {
			rowStyles.push(styles.rowFooter);
		}
	}

	if (stripe && !header && !footer) {
		rowStyles.push(styles.rowStripe);
	}

	const styleArray = style ? [...rowStyles, style] : rowStyles;
	const childArray = Children.toArray(children);

	const processedChildren = childArray.map((child, i) => {
		if (isValidElement<TableCellProps>(child) && child.type === TableCell) {
			return cloneElement(child, {
				_last: i === childArray.length - 1,
				footer,
				header,
				variant,
			});
		}

		return child;
	});

	return (
		<View style={styleArray} wrap={false}>
			{processedChildren}
		</View>
	);
};

export const TableCell = ({
	_last,
	align,
	children,
	footer,
	header,
	style,
	variant = "line",
	width,
}: TableCellProps) => {
	const theme = defaultTheme;
	const styles = createTableStyles(theme);
	const cellStyles: Array<Style> = width !== undefined ? [styles.cellFixed, { width }] : [styles.cell];

	const cellVariantStyles = {
		bordered: styles.cellBordered,
		compact: styles.cellCompact,
		grid: undefined,
		line: undefined,
		minimal: styles.cellMinimal,
		"primary-header": styles.cellPrimaryHeader,
		striped: styles.cellStriped,
	} satisfies Record<TableVariant, Style | undefined>;

	const cellVariantStyle = cellVariantStyles[variant];

	if (cellVariantStyle) {
		cellStyles.push(cellVariantStyle);
	}

	if (variant === "grid" && !_last) {
		cellStyles.push(styles.cellGridBorder);
	} else if (variant === "bordered" && !_last) {
		cellStyles.push(styles.cellBorderedBorder);
	}

	if (align) {
		cellStyles.push({ textAlign: align });
	}

	const styleArray = style ? [...cellStyles, style] : cellStyles;
	const textStyleReference: MutableReference<Style> = { value: styles.cellText };

	if (header) {
		textStyleReference.value = {
			bordered: styles.cellTextHeaderBordered,
			compact: styles.cellTextHeaderCompact,
			grid: styles.cellTextHeaderGrid,
			line: styles.cellTextHeaderLine,
			minimal: styles.cellTextHeaderMinimal,
			"primary-header": styles.cellTextHeaderPrimaryHeader,
			striped: styles.cellTextHeaderStriped,
		}[variant];
	} else if (footer) {
		textStyleReference.value = styles.cellTextFooter;
	} else if (variant === "compact") {
		textStyleReference.value = styles.cellTextCompact;
	}

	const content =
		Object.prototype.toString.call(children) === "[object String]" ? (
			<PDFText style={[textStyleReference.value, align ? { textAlign: align } : {}, { margin: 0, padding: 0 }]}>
				{String(children)}
			</PDFText>
		) : (
			children
		);

	return <View style={styleArray}>{content}</View>;
};
