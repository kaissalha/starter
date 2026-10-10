import type { PdfxTheme } from "../../lib/theme";

export type GraphWidthOptions = { containerPadding?: number; pageWidth?: number; wrapperPadding?: number };

export type GraphDataPoint = { color?: string; label: string; value: number };

export type GraphSeries = { color?: string; data: Array<GraphDataPoint>; name: string };

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

const A4_WIDTH = 595;

export const GRAPH_SAFE_WIDTHS = { default: 420, inSection: 400, inSectionWithWrapper: 380 } as const;

export const getGraphWidth = (theme: PdfxTheme, options: GraphWidthOptions = {}): number => {
	const { containerPadding = 0, pageWidth = A4_WIDTH, wrapperPadding = 0 } = options;
	const { marginLeft, marginRight } = theme.spacing.page;

	return Math.max(Math.floor(pageWidth - marginLeft - marginRight - containerPadding * 2 - wrapperPadding * 2), 100);
};

const CHART_MARGINS = { axisBottom: 24, axisLeft: 40, pieBottom: 10, pieLeft: 10, right: 10, top: 10 } as const;

export const normalizeData = (data: Array<GraphDataPoint> | Array<GraphSeries>): Array<GraphSeries> => {
	if (data.length === 0) {
		return [];
	}

	const points = data.filter(
		(entry): entry is GraphDataPoint => Object.hasOwn(entry, "label") && Object.hasOwn(entry, "value")
	);

	if (points.length === data.length) {
		return [{ data: points, name: "Series 1" }];
	}

	return data.filter((entry): entry is GraphSeries => Object.hasOwn(entry, "name") && Object.hasOwn(entry, "data"));
};

export const computeYTicks = (min: number, max: number, count: number): Array<number> => {
	if (min === max) {
		return [0, max || 1];
	}

	const step = (max - min) / (count - 1);

	return Array.from({ length: count }, (_, i) => Math.round((min + i * step) * 100) / 100);
};

export const fmtNum = (v: number): string => {
	if (Math.abs(v) >= 1_000_000) {
		return `${(v / 1_000_000).toFixed(1)}M`;
	}

	if (Math.abs(v) >= 1000) {
		return `${(v / 1000).toFixed(1)}K`;
	}

	if (!Number.isInteger(v)) {
		return v.toFixed(1);
	}

	return String(v);
};

export const truncate = (s: string, maxLen: number): string => (s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s);

export const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
	const rad = ((angleDeg - 90) * Math.PI) / 180;

	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

export const arcPath = ({
	cx,
	cy,
	endAngle,
	innerR = 0,
	r,
	startAngle,
}: {
	cx: number;
	cy: number;
	endAngle: number;
	innerR?: number;
	r: number;
	startAngle: number;
}): string => {
	const safeEnd = Math.min(endAngle, startAngle + 359.999);
	const large = safeEnd - startAngle > 180 ? 1 : 0;
	const s = polarToCartesian(cx, cy, r, safeEnd);
	const e = polarToCartesian(cx, cy, r, startAngle);

	if (innerR === 0) {
		return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;
	}

	const si = polarToCartesian(cx, cy, innerR, safeEnd);
	const ei = polarToCartesian(cx, cy, innerR, startAngle);

	return [
		`M ${s.x} ${s.y}`,
		`A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`,
		`L ${ei.x} ${ei.y}`,
		`A ${innerR} ${innerR} 0 ${large} 1 ${si.x} ${si.y}`,
		"Z",
	].join(" ");
};

export const smoothPath = (points: Array<{ x: number; y: number }>, tension = 0.4): string => {
	if (points.length < 2) {
		return "";
	}

	if (points.length === 2) {
		return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
	}

	const parts: Array<string> = [`M ${points[0].x} ${points[0].y}`];

	for (const iReference = { value: 0 }; iReference.value < points.length - 1; iReference.value++) {
		const p0 = points[Math.max(iReference.value - 1, 0)];
		const p1 = points[iReference.value];
		const p2 = points[iReference.value + 1];
		const p3 = points[Math.min(iReference.value + 2, points.length - 1)];

		parts.push(
			`C ${p1.x + (p2.x - p0.x) * tension} ${p1.y + (p2.y - p0.y) * tension} ${p2.x - (p3.x - p1.x) * tension} ${p2.y - (p3.y - p1.y) * tension} ${p2.x} ${p2.y}`
		);
	}

	return parts.join(" ");
};

export const getDefaultPalette = (t: PdfxTheme): Array<string> => [
	t.colors.primary,
	t.colors.info,
	t.colors.success,
	t.colors.warning,
	t.colors.destructive,
	"#8B5CF6",
	"#F97316",
	"#14B8A6",
];

export const buildLayout = (
	series: Array<GraphSeries>,
	width: number,
	height: number,
	isPieOrDonut: boolean,
	yTickCount: number
): ChartLayout => {
	const mL = isPieOrDonut ? CHART_MARGINS.pieLeft : CHART_MARGINS.axisLeft;
	const mB = isPieOrDonut ? CHART_MARGINS.pieBottom : CHART_MARGINS.axisBottom;
	const chartX = mL;
	const chartY = CHART_MARGINS.top;
	const chartW = width - mL - CHART_MARGINS.right;
	const chartH = height - CHART_MARGINS.top - mB;
	const allValues = series.flatMap((s) => s.data.map((d) => d.value));
	const rawMin = Math.min(...allValues, 0);
	const rawMax = Math.max(...allValues, 1);
	const yMin = rawMin >= 0 ? 0 : rawMin;
	const yMax = rawMax + (rawMax - yMin) * 0.08;

	return {
		chartH,
		chartW,
		chartX,
		chartY,
		svgH: height,
		svgW: width,
		xLabels: series[0]?.data.map((d) => d.label) ?? [],
		yMax,
		yMin,
		yTicks: computeYTicks(yMin, yMax, yTickCount),
	};
};
