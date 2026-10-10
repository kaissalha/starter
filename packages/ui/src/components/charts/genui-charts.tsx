"use client";

import { lazy, type ReactNode, Suspense, useId } from "react";

import { useDirection } from "@base-ui/react/direction-provider";
import { useReducedMotion } from "motion/react";
import type { TooltipContentProps } from "recharts";
import { z } from "zod";

import {
	hasOpenUIVisibleContent,
	normalizeOpenUIIdentityText,
	normalizeOpenUIVisibleText,
	OPENUI_CHART_MAGNITUDE_LIMIT,
} from "@starter/genui/text";
import { cn } from "@starter/ui/lib/utils";

export type GenUISeries = {
	name: string;
	values: Array<number>;
};

type GenUIChartData = { entries: Array<GenUISeries>; labels: Array<string> };

type GenUIScalar = boolean | null | number | string | undefined;

type SeriesLike = { category?: GenUIScalar; props?: undefined; values?: GenUIScalar | Array<GenUIScalar> };

type SeriesNode = SeriesLike | { props: SeriesLike };

export type GenUIInput = GenUIScalar | Array<GenUIScalar> | SeriesNode | Array<SeriesNode>;

const canonicalTextSchema = z
	.string()
	.min(1)
	.refine(hasOpenUIVisibleContent)
	.refine((value) => value === normalizeOpenUIVisibleText(value));

const finiteNumbersSchema = z.compile(
	z.array(z.number().finite().min(-OPENUI_CHART_MAGNITUDE_LIMIT).max(OPENUI_CHART_MAGNITUDE_LIMIT)).min(1)
);

const nonemptyStringSchema = z.compile(canonicalTextSchema);

const nonemptyStringsSchema = z.compile(z.array(canonicalTextSchema).min(1));

const asArray = (value: GenUIInput) => {
	if (Array.isArray(value)) {
		return value;
	}

	if (value == null) {
		return [];
	}

	return [value];
};

const valuesAreUnique = (values: ReadonlyArray<string>) =>
	new Set(values.map((value) => normalizeOpenUIIdentityText(value).toLowerCase())).size === values.length;

const resolveSeriesLike = (node: GenUIInput): SeriesLike | null => {
	if (!(node instanceof Object) || Array.isArray(node)) {
		return null;
	}

	const value = node.props ?? node;

	return {
		category: value.category,
		values: value.values,
	};
};

const normalizeGenUIChartData = (labels: GenUIInput, series: GenUIInput): GenUIChartData => {
	const rawLabels = nonemptyStringsSchema.safeParse(asArray(labels));

	if (!rawLabels.success) {
		return { entries: [], labels: [] };
	}

	const parsed = asArray(series).flatMap((node) => {
		const props = resolveSeriesLike(node);

		if (!props) {
			return [];
		}

		const name = nonemptyStringSchema.safeParse(props.category);
		const values = finiteNumbersSchema.safeParse(props.values);

		return name.success && values.success ? [{ name: name.data, values: values.data }] : [];
	});

	const names = parsed.map((entry) => entry.name);

	if (
		parsed.length !== asArray(series).length ||
		parsed.some((entry) => entry.values.length !== rawLabels.data.length) ||
		!valuesAreUnique(rawLabels.data) ||
		!valuesAreUnique(names)
	) {
		return { entries: [], labels: [] };
	}

	return { entries: parsed, labels: rawLabels.data };
};

const prepareSpectrumChartData = (rawLabels: GenUIInput, rawSeries: GenUIInput) => {
	const { entries, labels } = normalizeGenUIChartData(rawLabels, rawSeries);

	const series = entries.map((entry, index) => ({
		...entry,
		color: `var(--chart-${(index % 5) + 1})`,
		key: `series${index}`,
	}));

	const rows = labels.map((label, index) => ({
		label,
		...Object.fromEntries(series.map((entry) => [entry.key, entry.values[index]])),
	}));

	const slices = labels.map((name, index) => ({
		fill: `var(--chart-${(index % 5) + 1})`,
		name,
		value: entries[0]?.values[index] ?? 0,
	}));

	return { entries, labels, rows, series, slices };
};

export const ChartTooltipContent = ({ active, label, payload }: Partial<TooltipContentProps<number, string>>) => {
	if (!active || !payload?.length) {
		return null;
	}

	return (
		<div className='min-w-30 rounded-lg bg-popover/90 px-3 py-2 text-xs text-popover-foreground smooth-shadow-sm ring-1 ring-border backdrop-blur-md'>
			{label != null && <p className='mb-1.5 font-medium'>{String(label)}</p>}
			<ul className='flex flex-col gap-1'>
				{payload
					.filter((item) => item.type !== "none")
					.map((item) => (
						<li className='flex items-center gap-2' key={String(item.name)}>
							<span
								aria-hidden
								className='size-2 shrink-0 rounded-xs'
								style={{ backgroundColor: item.color }}
							/>
							<span className='text-muted-foreground'>{item.name}</span>
							<span className='ms-auto font-mono tabular-nums'>{String(item.value ?? "")}</span>
						</li>
					))}
			</ul>
		</div>
	);
};

export const ChartSurface = ({
	ariaLabel,
	children,
	className,
	height,
	labels,
	legend,
	presentation,
	series,
}: {
	ariaLabel?: string;
	children: ReactNode;
	className?: string;
	height: number;
	labels: Array<string>;
	legend: Array<{ color: string; name: string }>;
	presentation: "default" | "sparkline";
	series: Array<GenUISeries>;
}) => (
	<div
		aria-label={ariaLabel}
		className={cn("genui-chart-surface w-full min-w-0 text-muted-foreground", className)}
		role='group'
	>
		<ul
			className={
				presentation === "sparkline"
					? "sr-only"
					: "mb-2 flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] tracking-wide"
			}
		>
			{legend.map((item) => (
				<li className='flex items-center gap-1.5' key={item.name}>
					<span
						aria-hidden
						className='size-2 shrink-0 rounded-xs ring-1 ring-border'
						style={{ backgroundColor: item.color }}
					/>
					{item.name}
				</li>
			))}
		</ul>
		<div className='relative min-w-0' style={{ height }}>
			{children}
		</div>
		<div className='sr-only'>
			<table aria-label={ariaLabel}>
				<thead>
					<tr>
						<td />
						{series.map(({ name }) => (
							<th key={name} scope='col'>
								{name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{labels.map((label, index) => (
						<tr key={label}>
							<th scope='row'>{label}</th>
							{series.map((entry) => (
								<td key={entry.name}>{String(entry.values[index])}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	</div>
);

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
