import type { ReactNode } from "react";
import { Fragment } from "react";

import { Text as PDFText } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { usePdfxTheme, useSafeMemo } from "../../lib/theme-context";
import { createCompactStyles, formatValue } from "./data-table-styles";
import type { DataTableProps, DataTableRow } from "./data-table-types";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "./table";

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
	const theme = usePdfxTheme();
	const compact = useSafeMemo(() => createCompactStyles(theme), [theme]);
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
