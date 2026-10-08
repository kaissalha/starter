import type { Style } from "@react-pdf/types";

export type GraphWidthOptions = { containerPadding?: number; pageWidth?: number; wrapperPadding?: number };

export type GraphVariant = "bar" | "horizontal-bar" | "line" | "area" | "pie" | "donut";

export type GraphLegendPosition = "bottom" | "right" | "none";

export type GraphDataPoint = { color?: string; label: string; value: number };

export type GraphSeries = { color?: string; data: Array<GraphDataPoint>; name: string };

export type GraphProps = {
	centerLabel?: string;
	colors?: Array<string>;
	containerPadding?: number;
	data: Array<GraphDataPoint> | Array<GraphSeries>;
	fullWidth?: boolean;
	height?: number;
	legend?: GraphLegendPosition;
	noWrap?: boolean;
	showDots?: boolean;
	showGrid?: boolean;
	showValues?: boolean;
	smooth?: boolean;
	style?: Style;
	subtitle?: string;
	title?: string;
	variant?: GraphVariant;
	width?: number;
	wrapperPadding?: number;
	xLabel?: string;
	yLabel?: string;
	yTicks?: number;
};

export type ChartLayout = {
	chartH: number;
	chartW: number;
	chartX: number;
	chartY: number;
	svgH: number;
	svgW: number;
	xLabels: Array<string>;
	yMax: number;
	yMin: number;
	yTicks: Array<number>;
};
