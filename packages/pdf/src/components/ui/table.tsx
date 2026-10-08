import { Children, type ReactNode, cloneElement, isValidElement } from "react";

import { Text as PDFText, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";
import { createTableStyles } from "./table-styles";
import type { TableCellProps, TableProps, TableRowProps, TableSectionProps, TableVariant } from "./table-types";

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
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createTableStyles(theme), [theme]);
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
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createTableStyles(theme), [theme]);
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
	const theme = usePdfxTheme();
	const styles = useSafeMemo(() => createTableStyles(theme), [theme]);
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
