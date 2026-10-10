import type { ReactNode } from "react";

import {
	Circle,
	G,
	Line,
	Path,
	Rect,
	StyleSheet,
	Svg,
	Text as SvgText,
	Text as PDFText,
	View,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { defaultTheme, type PdfxTheme } from "../../lib/theme";
import {
	GRAPH_SAFE_WIDTHS,
	arcPath,
	buildLayout,
	type ChartLayout,
	fmtNum,
	getDefaultPalette,
	getGraphWidth,
	type GraphDataPoint,
	type GraphSeries,
	normalizeData,
	polarToCartesian,
	smoothPath,
	truncate,
} from "./graph-utils";

export type GraphVariant = "bar" | "horizontal-bar" | "line" | "area" | "pie" | "donut";

export type GraphLegendPosition = "bottom" | "right" | "none";

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

const createGraphStyles = (t: PdfxTheme) =>
	StyleSheet.create({
		chartWithRightLegend: { alignItems: "flex-start", display: "flex", flexDirection: "row" },
		container: { display: "flex", flexDirection: "column", marginBottom: t.spacing.componentGap },
		legendColumn: {
			display: "flex",
			flexDirection: "column",
			gap: 8,
			marginLeft: 12,
			marginTop: 18,
			minWidth: 120,
		},
		legendItem: { alignItems: "center", display: "flex", flexDirection: "row", gap: 4 },
		legendRow: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
		legendText: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
		},
		subtitle: {
			color: t.colors.mutedForeground,
			fontFamily: t.typography.body.fontFamily,
			fontSize: t.primitives.typography.xs,
			marginBottom: 6,
		},
		title: {
			color: t.colors.foreground,
			fontFamily: t.typography.heading.fontFamily,
			fontSize: t.primitives.typography.base,
			fontWeight: t.primitives.fontWeights.semibold,
			marginBottom: 2,
		},
	});

const renderGridAndYAxis = ({
	chartW,
	chartX,
	gridColor,
	showGrid,
	textColor,
	ticks,
	toY,
}: {
	chartW: number;
	chartX: number;
	gridColor: string;
	showGrid: boolean;
	textColor: string;
	ticks: Array<number>;
	toY: (v: number) => number;
}) => (
	<>
		{ticks.map((tick) => {
			const ty = toY(tick);

			return (
				<G key={`grid-${tick}`}>
					{showGrid && (
						<Line
							stroke={gridColor}
							strokeDasharray='3 3'
							strokeWidth={0.5}
							x1={chartX}
							x2={chartX + chartW}
							y1={ty}
							y2={ty}
						/>
					)}
					<SvgText fill={textColor} style={{ fontSize: 7 }} textAnchor='end' x={chartX - 4} y={ty + 3}>
						{fmtNum(tick)}
					</SvgText>
				</G>
			);
		})}
	</>
);

const renderBarChart = ({
	layout,
	palette,
	series,
	showGrid,
	showValues,
	theme,
}: {
	layout: ChartLayout;
	palette: Array<string>;
	series: Array<GraphSeries>;
	showGrid: boolean;
	showValues: boolean;
	theme: PdfxTheme;
}) => {
	const { chartH, chartW, chartX, chartY, xLabels, yMax, yMin, yTicks } = layout;
	const nCategories = xLabels.length;
	const nSeries = series.length;
	const groupGap = 0.25;
	const groupW = chartW / nCategories;
	const barW = (groupW * (1 - groupGap)) / nSeries;
	const textColor = theme.colors.mutedForeground;
	const gridColor = theme.colors.border;
	const axisColor = theme.colors.foreground;
	const range = yMax - yMin || 1;
	const toY = (v: number) => chartY + chartH - ((v - yMin) / range) * chartH;

	return (
		<>
			{renderGridAndYAxis({ chartW, chartX, gridColor, showGrid, textColor, ticks: yTicks, toY })}
			<Line
				stroke={axisColor}
				strokeWidth={1}
				x1={chartX}
				x2={chartX + chartW}
				y1={chartY + chartH}
				y2={chartY + chartH}
			/>
			{xLabels.map((label, ci) => {
				const groupLeft = chartX + ci * groupW + groupW * (groupGap / 2);

				return (
					<G key={`group-${ci}`}>
						{series.map((s, si) => {
							const val = s.data[ci]?.value ?? 0;
							const color = s.data[ci]?.color ?? s.color ?? palette[si % palette.length];
							const barH = ((val - yMin) / range) * chartH;
							const bx = groupLeft + si * barW;
							const by = chartY + chartH - barH;

							return (
								<G key={`bar-${ci}-${si}`}>
									<Rect fill={color} height={barH} width={barW - 1} x={bx} y={by} />
									{showValues && barH > 10 && (
										<SvgText
											fill={axisColor}
											style={{ fontSize: 6 }}
											textAnchor='middle'
											x={bx + barW / 2 - 0.5}
											y={by - 2}
										>
											{fmtNum(val)}
										</SvgText>
									)}
								</G>
							);
						})}
						<SvgText
							fill={textColor}
							style={{ fontSize: 7 }}
							textAnchor='middle'
							x={groupLeft + (nSeries * barW) / 2}
							y={chartY + chartH + 10}
						>
							{truncate(label, 10)}
						</SvgText>
					</G>
				);
			})}
		</>
	);
};

const renderHorizontalBarChart = (
	series: Array<GraphSeries>,
	layout: ChartLayout,
	palette: Array<string>,
	showValues: boolean,
	theme: PdfxTheme
) => {
	const { chartH, chartW, chartX, chartY, xLabels } = layout;
	const nCategories = xLabels.length;
	const allValues = series.flatMap((s) => s.data.map((d) => d.value));
	const maxVal = Math.max(...allValues, 1);
	const rowH = chartH / nCategories;
	const barH = rowH * 0.5;
	const textColor = theme.colors.mutedForeground;
	const axisColor = theme.colors.foreground;
	const labelW = 60;

	return (
		<>
			{xLabels.map((label, ci) => {
				const rowY = chartY + ci * rowH;
				const val = series[0]?.data[ci]?.value ?? 0;
				const color = series[0]?.data[ci]?.color ?? series[0]?.color ?? palette[ci % palette.length];
				const barW = (val / maxVal) * (chartW - labelW);

				return (
					<G key={`hbar-${ci}`}>
						<SvgText
							fill={textColor}
							style={{ fontSize: 7 }}
							textAnchor='end'
							x={chartX + labelW - 4}
							y={rowY + rowH / 2 + 3}
						>
							{truncate(label, 14)}
						</SvgText>
						<Rect
							fill={color}
							height={barH}
							width={Math.max(barW, 1)}
							x={chartX + labelW}
							y={rowY + (rowH - barH) / 2}
						/>
						{showValues && (
							<SvgText
								fill={axisColor}
								style={{ fontSize: 6 }}
								textAnchor='start'
								x={chartX + labelW + barW + 3}
								y={rowY + rowH / 2 + 3}
							>
								{fmtNum(val)}
							</SvgText>
						)}
					</G>
				);
			})}
			<Line
				stroke={axisColor}
				strokeWidth={1}
				x1={chartX + labelW}
				x2={chartX + labelW}
				y1={chartY}
				y2={chartY + chartH}
			/>
		</>
	);
};

const renderLineAreaChart = ({
	isArea,
	layout,
	palette,
	series,
	showDots,
	showGrid,
	showValues,
	smooth,
	theme,
}: {
	isArea: boolean;
	layout: ChartLayout;
	palette: Array<string>;
	series: Array<GraphSeries>;
	showDots: boolean;
	showGrid: boolean;
	showValues: boolean;
	smooth: boolean;
	theme: PdfxTheme;
}) => {
	const { chartH, chartW, chartX, chartY, xLabels, yMax, yMin, yTicks } = layout;
	const range = yMax - yMin || 1;
	const textColor = theme.colors.mutedForeground;
	const gridColor = theme.colors.border;
	const axisColor = theme.colors.foreground;
	const nPoints = xLabels.length;
	const xFor = (i: number) => chartX + (i / Math.max(nPoints - 1, 1)) * chartW;
	const yFor = (v: number) => chartY + chartH - ((v - yMin) / range) * chartH;

	return (
		<>
			{renderGridAndYAxis({ chartW, chartX, gridColor, showGrid, textColor, ticks: yTicks, toY: yFor })}
			<Line
				stroke={axisColor}
				strokeWidth={1}
				x1={chartX}
				x2={chartX + chartW}
				y1={chartY + chartH}
				y2={chartY + chartH}
			/>
			{series.map((s, si) => {
				const color = s.color ?? palette[si % palette.length];
				const points = s.data.map((d, i) => ({ x: xFor(i), y: yFor(d.value) }));
				const lineDStr = smooth ? smoothPath(points) : `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
				const lastPoint = points.at(-1);

				const areaPath =
					isArea && points.length > 1 && lastPoint
						? `${lineDStr} L ${lastPoint.x} ${chartY + chartH} L ${points[0].x} ${chartY + chartH} Z`
						: null;

				return (
					<G key={`series-${si}`}>
						{isArea && areaPath && <Path d={areaPath} fill={color} fillOpacity={0.2} stroke='none' />}
						<Path d={lineDStr} fill='none' stroke={color} strokeWidth={2} />
						{showDots &&
							points.map((p, pi) => <Circle cx={p.x} cy={p.y} fill={color} key={`dot-${pi}`} r={3} />)}
						{showValues &&
							points.map((p, pi) => (
								<SvgText
									fill={color}
									key={`val-${pi}`}
									style={{ fontSize: 6 }}
									textAnchor='middle'
									x={p.x}
									y={p.y - 5}
								>
									{fmtNum(s.data[pi].value)}
								</SvgText>
							))}
					</G>
				);
			})}
			{xLabels.map((label, i) => (
				<SvgText
					fill={textColor}
					key={`xlabel-${label}`}
					style={{ fontSize: 7 }}
					textAnchor='middle'
					x={xFor(i)}
					y={chartY + chartH + 10}
				>
					{truncate(label, 8)}
				</SvgText>
			))}
		</>
	);
};

const renderPieDonutChart = ({
	centerLabel,
	isDonut,
	layout,
	palette,
	series,
	theme,
}: {
	centerLabel?: string;
	isDonut: boolean;
	layout: ChartLayout;
	palette: Array<string>;
	series: Array<GraphSeries>;
	theme: PdfxTheme;
}) => {
	const { svgH, svgW } = layout;
	const cx = svgW / 2;
	const cy = svgH / 2;
	const r = Math.min(svgW, svgH) / 2 - 20;
	const innerR = isDonut ? r * 0.52 : 0;
	const textColor = theme.colors.mutedForeground;
	const data = series[0]?.data ?? [];
	const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
	const currentAngleReference = { value: 0 };

	return (
		<>
			{data.map((d, i) => {
				const color = d.color ?? palette[i % palette.length];
				const sweep = (d.value / total) * 360;
				const midAngle = currentAngleReference.value + sweep / 2;

				const path = arcPath({
					cx,
					cy,
					endAngle: currentAngleReference.value + sweep,
					innerR,
					r,
					startAngle: currentAngleReference.value,
				});

				currentAngleReference.value += sweep;
				const labelR = r * 1.18;
				const lp = polarToCartesian(cx, cy, labelR, midAngle);
				const anchor = lp.x > cx ? "start" : "end";

				return (
					<G key={`slice-${i}`}>
						<Path d={path} fill={color} stroke='white' strokeWidth={1} />
						{sweep > 15 && (
							<SvgText fill={textColor} style={{ fontSize: 7 }} textAnchor={anchor} x={lp.x} y={lp.y + 3}>
								{truncate(d.label, 10)}
							</SvgText>
						)}
					</G>
				);
			})}
			{isDonut && centerLabel && (
				<>
					<Circle cx={cx} cy={cy} fill='white' r={innerR} />
					<SvgText
						fill={theme.colors.foreground}
						style={{ fontSize: 9, fontWeight: "bold" }}
						textAnchor='middle'
						x={cx}
						y={cy + 4}
					>
						{centerLabel}
					</SvgText>
				</>
			)}
		</>
	);
};

const Legend = ({
	palette,
	position = "bottom",
	series,
	styles,
}: {
	palette: Array<string>;
	position?: "bottom" | "right";
	series: Array<GraphSeries>;
	styles: ReturnType<typeof createGraphStyles>;
}) => {
	const containerStyle = position === "right" ? styles.legendColumn : styles.legendRow;

	return (
		<View style={containerStyle}>
			{series.map((s, i) => (
				<View key={s.name} style={styles.legendItem}>
					<Svg height={10} width={10}>
						<Rect fill={s.color ?? palette[i % palette.length]} height={8} width={8} x={0} y={2} />
					</Svg>
					<PDFText style={styles.legendText}>{s.name}</PDFText>
				</View>
			))}
		</View>
	);
};

const renderGraphVariant = ({
	centerLabel,
	layout,
	palette,
	series,
	showDots,
	showGrid,
	showValues,
	smooth,
	theme,
	variant,
}: {
	centerLabel?: string;
	layout: ChartLayout;
	palette: Array<string>;
	series: Array<GraphSeries>;
	showDots: boolean;
	showGrid: boolean;
	showValues: boolean;
	smooth: boolean;
	theme: PdfxTheme;
	variant: NonNullable<GraphProps["variant"]>;
}) => {
	switch (variant) {
		case "bar":
			return renderBarChart({ layout, palette, series, showGrid, showValues, theme });
		case "horizontal-bar":
			return renderHorizontalBarChart(series, layout, palette, showValues, theme);
		case "line":
		case "area":
			return renderLineAreaChart({
				isArea: variant === "area",
				layout,
				palette,
				series,
				showDots,
				showGrid,
				showValues,
				smooth,
				theme,
			});
		case "pie":
			return renderPieDonutChart({ isDonut: false, layout, palette, series, theme });
		case "donut":
			return renderPieDonutChart({ centerLabel, isDonut: true, layout, palette, series, theme });
	}
};

const GraphFrame = ({
	chartContent,
	chartW,
	chartX,
	height,
	isPieOrDonut,
	legend,
	palette,
	series,
	showLegend,
	styles,
	subtitle,
	theme,
	title,
	width,
	xLabel,
	yLabel,
}: Pick<GraphProps, "legend" | "subtitle" | "title" | "xLabel" | "yLabel"> & {
	chartContent: ReactNode;
	chartW: number;
	chartX: number;
	height: number;
	isPieOrDonut: boolean;
	palette: Array<string>;
	series: Array<GraphSeries>;
	showLegend: boolean;
	styles: ReturnType<typeof createGraphStyles>;
	theme: PdfxTheme;
	width: number;
}) => (
	<>
		{title && <PDFText style={styles.title}>{title}</PDFText>}
		{subtitle && <PDFText style={styles.subtitle}>{subtitle}</PDFText>}
		<View style={legend === "right" ? styles.chartWithRightLegend : undefined}>
			<Svg height={height} width={width}>
				{chartContent}
				{!isPieOrDonut && xLabel && (
					<SvgText
						fill={theme.colors.mutedForeground}
						style={{ fontSize: 8 }}
						textAnchor='middle'
						x={chartX + chartW / 2}
						y={height - 2}
					>
						{xLabel}
					</SvgText>
				)}
				{!isPieOrDonut && yLabel && (
					<SvgText
						fill={theme.colors.mutedForeground}
						style={{ fontSize: 8 }}
						textAnchor='start'
						x={2}
						y={10}
					>
						{yLabel}
					</SvgText>
				)}
			</Svg>
			{showLegend && legend === "right" && (
				<Legend palette={palette} position='right' series={series} styles={styles} />
			)}
		</View>
		{showLegend && legend === "bottom" && (
			<Legend palette={palette} position='bottom' series={series} styles={styles} />
		)}
	</>
);

export const Graph = ({
	centerLabel,
	colors,
	containerPadding = 0,
	data,
	fullWidth = false,
	height = 260,
	legend = "bottom",
	noWrap = true,
	showDots = true,
	showGrid = true,
	showValues = false,
	smooth = false,
	style,
	subtitle,
	title,
	variant = "bar",
	width: explicitWidth,
	wrapperPadding = 0,
	xLabel,
	yLabel,
	yTicks: yTickCount = 5,
}: GraphProps) => {
	const theme = defaultTheme;
	const styles = createGraphStyles(theme);
	const palette = colors ?? getDefaultPalette(theme);
	const series = normalizeData(data);

	const width = fullWidth
		? getGraphWidth(theme, { containerPadding, wrapperPadding })
		: (explicitWidth ?? GRAPH_SAFE_WIDTHS.default);

	const isPieOrDonut = variant === "pie" || variant === "donut";
	const layout = buildLayout(series, width, height, isPieOrDonut, yTickCount);
	const { chartW, chartX } = layout;

	const chartContent = renderGraphVariant({
		centerLabel,
		layout,
		palette,
		series,
		showDots,
		showGrid,
		showValues,
		smooth,
		theme,
		variant,
	});

	const showLegend = legend !== "none" && !isPieOrDonut;
	const containerStyles: Array<Style> = [styles.container];

	if (style) {
		containerStyles.push(style);
	}

	const content = (
		<View style={containerStyles}>
			<GraphFrame
				chartContent={chartContent}
				chartW={chartW}
				chartX={chartX}
				height={height}
				isPieOrDonut={isPieOrDonut}
				legend={legend}
				palette={palette}
				series={series}
				showLegend={showLegend}
				styles={styles}
				subtitle={subtitle}
				theme={theme}
				title={title}
				width={width}
				xLabel={xLabel}
				yLabel={yLabel}
			/>
		</View>
	);

	return noWrap ? <View wrap={false}>{content}</View> : content;
};
