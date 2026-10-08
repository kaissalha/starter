import type React from "react";

import type { Style } from "@react-pdf/types";

import type { TableVariant } from "./table-types";

export type DataTableSize = "default" | "compact";

export type DataTableValue = Date | React.ReactNode;

export type DataTableRow = Record<string, DataTableValue>;

export type DataTableColumn<T extends DataTableRow = DataTableRow> = {
	align?: "left" | "center" | "right";
	header: string;
	key: keyof T & string;
	render?: (value: T[keyof T], row: T) => React.ReactNode;
	renderFooter?: (value: DataTableValue) => React.ReactNode;
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
