import type React from "react";

import type { Style } from "@react-pdf/types";

export type TableVariant = "line" | "grid" | "minimal" | "striped" | "compact" | "bordered" | "primary-header";

export type TableProps = {
	children: React.ReactNode;
	noWrap?: boolean;
	style?: Style;
	variant?: TableVariant;
	zebraStripe?: boolean;
};

export type TableSectionProps = {
	children: React.ReactNode;
	style?: Style;
};

export type TableRowProps = {
	children: React.ReactNode;
	footer?: boolean;
	header?: boolean;
	stripe?: boolean;
	style?: Style;
	variant?: TableVariant;
};

export type TableCellProps = {
	_last?: boolean;
	align?: "left" | "center" | "right";
	children: React.ReactNode;
	footer?: boolean;
	header?: boolean;
	style?: Style;
	variant?: TableVariant;
	width?: string | number;
};
