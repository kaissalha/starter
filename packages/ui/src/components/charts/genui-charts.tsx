"use client";

import { lazy, Suspense, useId } from "react";

import { useDirection } from "@base-ui/react/direction-provider";
import { useReducedMotion } from "motion/react";

import { prepareSpectrumChartData, type GenUIInput } from "./genui-chart-data";
import { ChartSurface, ChartTooltipContent } from "./spectrum-chart-surface";

export type SpectrumChartProps = {
	ariaLabel?: string;
	className?: string;
	height?: number;
	horizontal?: boolean;
	kind: "line" | "area" | "bar" | "composed" | "pie" | "radar" | "radial";
	labels: GenUIInput;
	presentation?: "default" | "sparkline";
	series: GenUIInput;
	stacked?: boolean;
	variant?: "linear" | "natural" | "step" | "pie" | "donut";
	xAxisTicks?: number;
	yAxisTicks?: number;
};

const curves = { donut: "linear", linear: "linear", natural: "monotone", pie: "linear", step: "step" } as const;

const axisTick = { fill: "currentColor", fontFamily: "ui-monospace, monospace", fontSize: 11 };

const SeriesGradients = ({ id, series }: { id: string; series: Array<{ color: string; key: string }> }) => (
	<defs>
		{series.map((entry) => (
			<linearGradient id={`${id}-${entry.key}`} key={entry.key} x1='0' x2='0' y1='0' y2='1'>
				<stop offset='5%' stopColor={entry.color} stopOpacity={0.32} />
				<stop offset='95%' stopColor={entry.color} stopOpacity={0.02} />
			</linearGradient>
		))}
	</defs>
);

const SpectrumChartContent = ({
	ariaLabel,
	Charts,
	className,
	height = 280,
	horizontal = false,
	kind,
	labels: rawLabels,
	presentation = "default",
	series: rawSeries,
	stacked = false,
	variant = "natural",
	xAxisTicks,
	yAxisTicks,
}: SpectrumChartProps & { Charts: typeof import("recharts") }) => {
	const id = useId().replaceAll(":", "");
	const reduce = useReducedMotion();
	const rtl = useDirection() === "rtl";
	const { entries, labels, rows, series, slices } = prepareSpectrumChartData(rawLabels, rawSeries);
	const compact = presentation === "sparkline";
	const polar = ["pie", "radial"].includes(kind);
	const nonnegative = polar || kind === "radar" || stacked;

	if (
		!labels.length ||
		!entries.length ||
		(polar && entries.length !== 1) ||
		(nonnegative && entries.some((entry) => entry.values.some((value) => value < 0)))
	) {
		return null;
	}

	const animation = { animationDuration: 220, isAnimationActive: reduce === false };
	const curve = curves[variant];

	const tooltip = (
		<Charts.Tooltip
			content={<ChartTooltipContent />}
			cursor={{ stroke: "currentColor", strokeDasharray: "4 4", strokeOpacity: 0.22 }}
		/>
	);

	const marks = series.map((entry, index) => {
		const props = { ...animation, dataKey: entry.key, name: entry.name };

		if (kind === "bar" || (kind === "composed" && index === 0)) {
			return (
				<Charts.Bar
					{...props}
					fill={entry.color}
					key={entry.key}
					maxBarSize={36}
					radius={4}
					stackId={stacked ? "values" : undefined}
				/>
			);
		}

		if (kind === "area") {
			return (
				<Charts.Area
					{...props}
					activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
					dot={rows.length === 1}
					fill={`url(#${id}-${entry.key})`}
					key={entry.key}
					stackId={stacked ? "values" : undefined}
					stroke={entry.color}
					strokeWidth={2}
					type={curve}
				/>
			);
		}

		return (
			<Charts.Line
				{...props}
				activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
				dot={compact ? rows.length === 1 : { r: 3, stroke: "var(--background)", strokeWidth: 1.5 }}
				key={entry.key}
				stroke={entry.color}
				strokeWidth={2.25}
				type={curve}
			/>
		);
	});

	const renderPlot = () => {
		if (kind === "pie") {
			return (
				<Charts.PieChart accessibilityLayer>
					{tooltip}
					<Charts.Pie
						{...animation}
						cornerRadius={6}
						data={slices}
						dataKey='value'
						innerRadius={variant === "donut" ? "52%" : 0}
						nameKey='name'
						outerRadius='78%'
						paddingAngle={2}
						stroke='var(--background)'
						strokeWidth={1.5}
					/>
				</Charts.PieChart>
			);
		}

		if (kind === "radial") {
			return (
				<Charts.RadialBarChart
					accessibilityLayer
					barSize={16}
					data={slices}
					endAngle={-270}
					innerRadius='25%'
					outerRadius='90%'
					startAngle={90}
				>
					<Charts.PolarAngleAxis
						axisLine={false}
						domain={[0, Math.max(...slices.map((slice) => slice.value)) || 1]}
						tick={false}
						type='number'
					/>
					{tooltip}
					<Charts.RadialBar
						{...animation}
						background={{ fill: "var(--muted)" }}
						cornerRadius={8}
						dataKey='value'
					/>
				</Charts.RadialBarChart>
			);
		}

		if (kind === "radar") {
			return (
				<Charts.RadarChart accessibilityLayer data={rows} outerRadius='72%'>
					<Charts.PolarGrid stroke='currentColor' strokeOpacity={0.18} />
					<Charts.PolarAngleAxis dataKey='label' tick={axisTick} />
					<Charts.PolarRadiusAxis axisLine={false} tick={false} />
					{tooltip}
					{series.map((entry) => (
						<Charts.Radar
							{...animation}
							dataKey={entry.key}
							fill={entry.color}
							fillOpacity={0.22}
							key={entry.key}
							name={entry.name}
							stroke={entry.color}
							strokeWidth={2}
						/>
					))}
				</Charts.RadarChart>
			);
		}

		return (
			<Charts.ComposedChart
				accessibilityLayer
				barCategoryGap='18%'
				barGap={4}
				data={rows}
				layout={horizontal ? "vertical" : "horizontal"}
				margin={{ bottom: 0, left: rtl ? 32 : 0, right: rtl ? 0 : 16, top: 8 }}
			>
				<SeriesGradients id={id} series={series} />
				<Charts.CartesianGrid
					horizontal={!compact && !horizontal}
					stroke='currentColor'
					strokeDasharray='3 3'
					strokeOpacity={0.14}
					vertical={!compact && horizontal}
				/>
				<Charts.XAxis
					axisLine={false}
					dataKey={horizontal ? undefined : "label"}
					hide={compact}
					minTickGap={24}
					reversed={rtl && !horizontal}
					tick={axisTick}
					tickCount={xAxisTicks}
					tickLine={false}
					tickMargin={8}
					type={horizontal ? "number" : "category"}
				/>
				<Charts.YAxis
					axisLine={false}
					dataKey={horizontal ? "label" : undefined}
					hide={compact}
					orientation={rtl ? "right" : "left"}
					tick={axisTick}
					tickCount={yAxisTicks}
					tickLine={false}
					tickMargin={8}
					type={horizontal ? "category" : "number"}
					width={horizontal ? 100 : 44}
				/>
				{tooltip}
				{marks}
			</Charts.ComposedChart>
		);
	};

	return (
		<ChartSurface
			ariaLabel={ariaLabel}
			className={className}
			height={height}
			labels={labels}
			legend={polar ? slices.map((slice) => ({ color: slice.fill, name: slice.name })) : series}
			presentation={presentation}
			series={entries}
		>
			<Charts.ResponsiveContainer height='100%' minWidth={0} width='100%'>
				{renderPlot()}
			</Charts.ResponsiveContainer>
		</ChartSurface>
	);
};

const LazySpectrumChart = lazy(async () => {
	const Charts = await import("recharts");

	return { default: (props: SpectrumChartProps) => <SpectrumChartContent Charts={Charts} {...props} /> };
});

export const SpectrumChart = (props: SpectrumChartProps) => (
	<Suspense
		fallback={
			<div
				aria-busy
				className='w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none'
				style={{ height: props.height ?? 280 }}
			/>
		}
	>
		<LazySpectrumChart {...props} />
	</Suspense>
);
