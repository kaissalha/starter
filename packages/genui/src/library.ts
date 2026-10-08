import {
	type ActionPlan,
	type ComponentRenderer,
	createLibrary,
	defineComponent,
	type ElementNode,
	type Library,
	reactive,
	type StateField,
	type SubComponentOf,
	tagSchemaId,
} from "@openuidev/react-lang";
import { z } from "zod/v4";

import { hasOpenUIVisibleContent, normalizeOpenUIVisibleText, OPENUI_CHART_MAGNITUDE_LIMIT } from "./text";

export { type OpenUIFenceSegment, parseOpenUIFences } from "./openui";

type SeriesChartRenderer = ComponentRenderer<{
	labels: Array<string>;
	series: Array<SubComponentOf<{ category: string; values: Array<number> }>>;
	variant?: "linear" | "natural" | "step";
}>;

export type ChatGenUIRenderers = {
	AreaChart?: SeriesChartRenderer;
	BarChart?: ComponentRenderer<{
		labels: Array<string>;
		series: Array<SubComponentOf<{ category: string; values: Array<number> }>>;
		variant?: "grouped" | "stacked";
	}>;
	Button?: ComponentRenderer<{
		action?: ActionPlan;
		label: string;
		variant?: "primary" | "secondary";
	}>;
	Card?: ComponentRenderer<{ children: Array<ElementNode> }>;
	ComposedChart?: SeriesChartRenderer;
	FunnelChart?: ComponentRenderer<{ labels: Array<string>; values: Array<number> }>;
	LineChart?: ComponentRenderer<{
		labels: Array<string>;
		series: Array<SubComponentOf<{ category: string; values: Array<number> }>>;
		variant?: "linear" | "natural" | "step";
	}>;
	Metric?: ComponentRenderer<{
		detail?: string;
		label: string;
		tone?: "neutral" | "positive" | "negative";
		value: string;
	}>;
	PieChart?: ComponentRenderer<{ labels: Array<string>; values: Array<number>; variant?: "pie" | "donut" }>;
	RadarChart?: SeriesChartRenderer;
	RadialChart?: ComponentRenderer<{ labels: Array<string>; values: Array<number> }>;
	Select?: ComponentRenderer<{
		items: Array<SubComponentOf<{ label: string; value: string }>>;
		name: string;
		placeholder?: string;
		value: StateField<string>;
	}>;
};

const createCanonicalTextSchema = () =>
	z
		.string()
		.min(1)
		.refine(hasOpenUIVisibleContent)
		.refine((value) => value === normalizeOpenUIVisibleText(value));

const nonemptyTextSchema = createCanonicalTextSchema();

const seriesSchema = z.compile(
	z.object({
		category: nonemptyTextSchema,
		values: z
			.array(z.number().finite().min(-OPENUI_CHART_MAGNITUDE_LIMIT).max(OPENUI_CHART_MAGNITUDE_LIMIT))
			.min(1),
	})
);

const actionExpressionSchema = z.any();

tagSchemaId(actionExpressionSchema, "ActionExpression");

export const createChatGenUILibrary = (renderers: ChatGenUIRenderers = {}): Library => {
	const Series = defineComponent({
		component: () => null,
		description: "One named series of numeric values aligned to chart labels",
		name: "Series",

		props: seriesSchema,
	});

	const seriesChartDescriptions = {
		AreaChart: "Spectrum gradient area chart for trends",
		ComposedChart: "Spectrum composed chart: first series uses bars, remaining series use lines",
		LineChart: "Spectrum lines over ordered categories for trends and continuous data",
		RadarChart: "Spectrum radar chart for comparing nonnegative values across dimensions",
	};

	const seriesCharts = (["LineChart", "AreaChart", "ComposedChart", "RadarChart"] as const).map((name) =>
		defineComponent({
			component: renderers[name] ?? (() => null),
			description: seriesChartDescriptions[name],
			name,
			props: z.object({
				labels: z.array(nonemptyTextSchema).min(1),
				series: z.array(Series.ref).min(1),
				variant: z.enum(["linear", "natural", "step"]).optional(),
			}),
		})
	);

	const valueChartProps = z.object({
		labels: z.array(nonemptyTextSchema).min(1),
		values: z.array(z.number().finite().nonnegative().max(OPENUI_CHART_MAGNITUDE_LIMIT)).min(1),
	});

	const valueCharts = (["PieChart", "RadialChart"] as const).map((name) =>
		defineComponent({
			component: renderers[name] ?? (() => null),
			description:
				name === "PieChart"
					? "Spectrum pie or donut chart for nonnegative parts of a whole"
					: "Spectrum radial bars comparing nonnegative values on a shared scale",
			name,
			props:
				name === "PieChart"
					? valueChartProps.extend({ variant: z.enum(["pie", "donut"]).optional() })
					: valueChartProps,
		})
	);

	const BarChart = defineComponent({
		component: renderers.BarChart ?? (() => null),
		description: "Vertical bars; use for comparing values across categories with one or more series",
		name: "BarChart",
		props: z.object({
			labels: z.array(nonemptyTextSchema).min(1),
			series: z.array(Series.ref).min(1),
			variant: z.enum(["grouped", "stacked"]).optional(),
		}),
	});

	const FunnelChart = defineComponent({
		component: renderers.FunnelChart ?? (() => null),
		description:
			"Conversion or pipeline funnel with stage labels and numeric values, typically decreasing from top to bottom",
		name: "FunnelChart",
		props: z.object({
			labels: z.array(nonemptyTextSchema).min(1),
			values: z.array(z.number().finite().nonnegative().max(OPENUI_CHART_MAGNITUDE_LIMIT)).min(1),
		}),
	});

	/* oxlint-disable perfectionist/sort-objects -- OpenUI Lang maps component arguments by schema insertion order. */
	const Metric = defineComponent({
		component: renderers.Metric ?? (() => null),
		description: "Compact KPI or summary metric with an optional supporting detail and sentiment tone",
		name: "Metric",
		props: z.object({
			label: nonemptyTextSchema,
			value: nonemptyTextSchema,
			detail: z.string().optional(),
			tone: z.enum(["neutral", "positive", "negative"]).optional(),
		}),
	});

	const SelectItem = defineComponent({
		component: () => null,
		description: "One option in a Select control",
		name: "SelectItem",
		props: z.object({
			value: nonemptyTextSchema,
			label: nonemptyTextSchema,
		}),
	});

	const Select = defineComponent({
		component: renderers.Select ?? (() => null),
		description: "Interactive selector bound to a $variable for switching the data shown in the UI",
		name: "Select",
		props: z.object({
			name: nonemptyTextSchema,
			items: z.array(SelectItem.ref).min(1),
			value: reactive(createCanonicalTextSchema()),
			placeholder: nonemptyTextSchema.optional(),
		}),
	});

	const Button = defineComponent({
		component: renderers.Button ?? (() => null),
		description: "Button that updates UI state, opens a safe URL, or continues the conversation",
		name: "Button",
		props: z.object({
			label: nonemptyTextSchema,
			action: actionExpressionSchema.optional(),
			variant: z.enum(["primary", "secondary"]).optional(),
		}),
	});
	/* oxlint-enable perfectionist/sort-objects */

	const Card = defineComponent({
		component: renderers.Card ?? (() => null),
		description:
			"Root container for an openui-lang block. Children stack vertically. Put titles, captions, and narrative in markdown outside the fence.",
		name: "Card",
		props: z.object({
			children: z
				.array(
					z.union([
						Metric.ref,

						BarChart.ref,
						FunnelChart.ref,
						...seriesCharts.map((chart) => chart.ref),
						...valueCharts.map((chart) => chart.ref),
						Select.ref,
						Button.ref,
					])
				)
				.min(1),
		}),
	});

	return createLibrary({
		componentGroups: [
			{
				components: ["Metric"],
				name: "Metrics",
				notes: ["- Use Metric for a small set of decision-relevant KPIs, not as a substitute for prose."],
			},
			{
				components: [
					"LineChart",
					"AreaChart",
					"BarChart",
					"ComposedChart",
					"PieChart",
					"RadarChart",
					"RadialChart",
					"FunnelChart",
					"Series",
				],
				name: "Charts",
				notes: [
					"- LineChart or AreaChart for trends over time or ordered categories.",
					"- ComposedChart draws the first series as bars and remaining series as lines on one shared scale.",
					"- PieChart for parts of a whole; use the donut variant for a ring. RadialChart compares values on one shared scale.",
					"- RadarChart compares nonnegative series across dimensions.",
					"- BarChart for comparing values across categories.",
					"- FunnelChart for stage conversion flows where each step is smaller than the previous.",
					"- Define series with Series(category, values) references for line and bar charts.",
				],
			},
			{
				components: ["Select", "SelectItem", "Button"],
				name: "Controls",
				notes: [
					"- Bind Select.value to a declared $variable and use that variable to change visible metrics or chart data.",
					"- Use Button actions only for @Set, @Reset, @ToAssistant, or @OpenUrl; never invent unsupported tool calls.",
				],
			},
		],
		components: [
			Card,
			Metric,
			Series,
			BarChart,
			FunnelChart,
			...seriesCharts,
			...valueCharts,
			SelectItem,
			Select,
			Button,
		],
		root: "Card",
	});
};

export const chatGenUIPromptLibrary = createChatGenUILibrary();
