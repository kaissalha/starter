import { Fragment, type ReactNode } from "react";

import { StyleSheet, Text as PDFText } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, type PdfxTheme } from "../../lib/theme";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow, type TableVariant } from "./table";

export type DataTableSize = "default" | "compact";

export type DataTableValue = Date | ReactNode;

export type DataTableRow = Record<string, DataTableValue>;

export type DataTableColumn<T extends DataTableRow = DataTableRow> = {
	align?: "left" | "center" | "right";
	header: string;
	key: keyof T & string;
	render?: (value: T[keyof T], row: T) => ReactNode;
	renderFooter?: (value: DataTableValue) => ReactNode;
	width?: string | number;
};

export type DataTableProps<T extends DataTableRow = DataTableRow> = {
	columns: Array<DataTableColumn<T>>;
	data: Array<T>;
	footer?: Partial<Record<keyof T & string, string | number>>;
	noWrap?: boolean;
	size?: DataTableSize;
	stripe?: boolean;
	style?: Style;
	variant?: TableVariant;
};

const createCompactStyles = (t: PdfxTheme) => {
	const { fontWeights, lineHeights, spacing } = t.primitives;

	return StyleSheet.create({
		cell: { paddingHorizontal: spacing[2], paddingVertical: spacing[0.5] },
		footerText: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
			fontWeight: fontWeights.semibold,
			lineHeight: lineHeights.normal,
		},
		headerText: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
			fontWeight: fontWeights.semibold,
			lineHeight: lineHeights.normal,
		},
		text: {
			color: t.colors.foreground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
			lineHeight: lineHeights.normal,
		},
	});
};

const formatValue = (value: DataTableValue): string => {
	if (value === null || value === undefined) {
		return "";
	}

	return String(value);
};

const renderCellContent = ({
	isCompact,
	rendered,
	text,
	textStyle,
}: {
	isCompact: boolean;
	rendered: ReactNode;
	text: string | null;
	textStyle: Array<Style>;
}) => {
	if (isCompact) {
		if (rendered !== null) {
			return rendered;
		}

		return <PDFText style={textStyle}>{text}</PDFText>;
	}

	if (rendered !== null) {
		return rendered;
	}

	return text;
};

export const DataTable = <T extends DataTableRow>({
	columns,
	data,
	footer,
	noWrap = false,
	size = "default",
	stripe = false,
	style,
	variant = "grid",
}: DataTableProps<T>) => {
	const theme = defaultTheme;
	const compact = createCompactStyles(theme);
	const isCompact = size === "compact";

	return (
		<Table noWrap={noWrap} style={style} variant={variant} zebraStripe={stripe}>
			<TableHeader>
				<TableRow header>
					{columns.map((col) => (
						<TableCell
							align={col.align ?? "left"}
							header
							key={col.key}
							style={isCompact ? compact.cell : undefined}
							width={col.width}
						>
							{isCompact ? (
								<PDFText style={[compact.headerText, col.align ? { textAlign: col.align } : {}]}>
									{col.header}
								</PDFText>
							) : (
								col.header
							)}
						</TableCell>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{data.map((row, i) => (
					<Fragment key={i}>
						<TableRow>
							{columns.map((col) => {
								const value = row[col.key];
								const rendered = col.render ? col.render(value, row) : null;
								const text = rendered === null ? formatValue(value) : null;

								return (
									<TableCell
										align={col.align ?? "left"}
										key={col.key}
										style={isCompact ? compact.cell : undefined}
										width={col.width}
									>
										{renderCellContent({
											isCompact,
											rendered,
											text,
											textStyle: [compact.text, col.align ? { textAlign: col.align } : {}],
										})}
									</TableCell>
								);
							})}
						</TableRow>
					</Fragment>
				))}
			</TableBody>
			{footer && (
				<TableFooter>
					<TableRow footer>
						{columns.map((col) => {
							const value = Object.hasOwn(footer, col.key) ? footer[col.key] : "";
							const rendered = col.renderFooter ? col.renderFooter(value) : null;
							const text = rendered === null ? formatValue(value) : null;

							return (
								<TableCell
									align={col.align ?? "left"}
									footer={!!value}
									key={col.key}
									style={isCompact ? compact.cell : undefined}
									width={col.width}
								>
									{renderCellContent({
										isCompact,
										rendered,
										text,
										textStyle: [
											value ? compact.footerText : compact.text,
											col.align ? { textAlign: col.align } : {},
										],
									})}
								</TableCell>
							);
						})}
					</TableRow>
				</TableFooter>
			)}
		</Table>
	);
};
