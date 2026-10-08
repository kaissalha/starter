"use client";

import { type ActionPlan, useIsStreaming, useStateField, useTriggerAction } from "@openuidev/react-lang";
import { z } from "zod";

import { type ChatGenUIRenderers, createChatGenUILibrary } from "@starter/genui/library";
import { hasOpenUIVisibleContent, normalizeOpenUIActionText, normalizeOpenUIVisibleText } from "@starter/genui/text";
import { Button } from "@starter/ui/components/button";
import { SpectrumChart } from "@starter/ui/components/charts/genui-charts";
import { Select, SelectItem, SelectPopup, SelectTrigger } from "@starter/ui/components/select";
import { cn } from "@starter/ui/lib/utils";

const canonicalTextSchema = z
	.string()
	.min(1)
	.refine(hasOpenUIVisibleContent)
	.refine((value) => value === normalizeOpenUIVisibleText(value));

const httpURLSchema = z.compile(z.url().refine((value) => /^https?:\/\//u.test(value)));

const metricPropsSchema = z.compile(
	z.strictObject({
		detail: z
			.string()
			.refine(
				(value) =>
					value.length === 0 ||
					(hasOpenUIVisibleContent(value) && value === normalizeOpenUIVisibleText(value))
			)
			.optional(),
		label: canonicalTextSchema,
		tone: z.enum(["neutral", "positive", "negative"]).optional(),
		value: canonicalTextSchema,
	})
);

const ChatGenUISelect: NonNullable<ChatGenUIRenderers["Select"]> = ({ props }) => {
	const isStreaming = useIsStreaming();
	const field = useStateField(props.name, props.value);
	const items = props.items;
	const selectedItem = items.find((item) => item.props.value === field.value);

	return (
		<Select
			disabled={isStreaming}
			onValueChange={(value) => {
				if (value) {
					field.setValue(value);
				}
			}}
			value={field.value}
		>
			<SelectTrigger aria-label={props.placeholder ?? props.name} className='w-fit min-w-44' size='sm'>
				<span className='truncate'>{selectedItem?.props.label ?? props.placeholder ?? props.name}</span>
			</SelectTrigger>
			<SelectPopup>
				{items.map((item) => (
					<SelectItem key={item.props.value} value={item.props.value}>
						{item.props.label}
					</SelectItem>
				))}
			</SelectPopup>
		</Select>
	);
};

const getOpenURLHostname = (action: ActionPlan | undefined) => {
	const step = action?.steps.find((candidate) => candidate.type === "open_url");

	if (step?.type !== "open_url") {
		return undefined;
	}

	const url = httpURLSchema.safeParse(step.url);

	return url.success ? new URL(url.data).hostname : undefined;
};

const getAssistantActionText = (action: ActionPlan | undefined) => {
	const step = action?.steps.find((candidate) => candidate.type === "continue_conversation");

	return step?.type === "continue_conversation" ? normalizeOpenUIActionText(step.message) : undefined;
};

const ChatGenUIButton: NonNullable<ChatGenUIRenderers["Button"]> = ({ props }) => {
	const isStreaming = useIsStreaming();
	const triggerAction = useTriggerAction();
	const hostname = getOpenURLHostname(props.action);
	const assistantText = getAssistantActionText(props.action);
	const disclosure = hostname ?? (assistantText === props.label ? undefined : assistantText);

	return (
		<Button
			aria-label={disclosure ? `${props.label} (${disclosure})` : undefined}
			disabled={isStreaming}
			onClick={() => triggerAction(props.label, undefined, props.action)}
			size='sm'
			variant={props.variant === "primary" ? "default" : "outline"}
		>
			<span>{props.label}</span>
			{disclosure && <span>({disclosure})</span>}
		</Button>
	);
};

const ChatGenUIMetric: NonNullable<ChatGenUIRenderers["Metric"]> = ({ props }) => {
	const metric = metricPropsSchema.safeParse(props);

	if (!metric.success) {
		return null;
	}

	return (
		<div className='w-full rounded-lg border border-border bg-muted/32 px-4 py-3'>
			<p className='text-sm text-muted-foreground'>{metric.data.label}</p>
			<p className='mt-1 text-2xl font-semibold tracking-tight'>{metric.data.value}</p>
			{metric.data.detail && (
				<p
					className={cn(
						"mt-1 text-xs text-muted-foreground",
						metric.data.tone === "positive" && "text-success",
						metric.data.tone === "negative" && "text-destructive"
					)}
				>
					{metric.data.detail}
				</p>
			)}
		</div>
	);
};

export const chatGenUILibrary = createChatGenUILibrary({
	AreaChart: ({ props }) => (
		<SpectrumChart
			kind='area'
			labels={props.labels}
			series={props.series.map((entry) => entry.props)}
			variant={props.variant}
		/>
	),
	BarChart: ({ props }) => (
		<SpectrumChart
			kind='bar'
			labels={props.labels}
			series={props.series.map((series) => series.props)}
			stacked={props.variant === "stacked"}
		/>
	),
	Button: ChatGenUIButton,
	Card: ({ props, renderNode }) => (
		<div className='flex w-full flex-col items-start gap-3'>{renderNode(props.children)}</div>
	),
	ComposedChart: ({ props }) => (
		<SpectrumChart
			kind='composed'
			labels={props.labels}
			series={props.series.map((entry) => entry.props)}
			variant={props.variant}
		/>
	),

	FunnelChart: ({ props }) => (
		<SpectrumChart
			horizontal
			kind='bar'
			labels={props.labels}
			series={[{ category: props.labels[0] ?? "", values: props.values }]}
		/>
	),
	LineChart: ({ props }) => (
		<SpectrumChart
			kind='line'
			labels={props.labels}
			series={props.series.map((series) => series.props)}
			variant={props.variant}
		/>
	),
	Metric: ChatGenUIMetric,
	PieChart: ({ props }) => (
		<SpectrumChart
			kind='pie'
			labels={props.labels}
			series={[{ category: props.labels[0] ?? "", values: props.values }]}
			variant={props.variant}
		/>
	),

	RadarChart: ({ props }) => (
		<SpectrumChart kind='radar' labels={props.labels} series={props.series.map((entry) => entry.props)} />
	),
	RadialChart: ({ props }) => (
		<SpectrumChart
			kind='radial'
			labels={props.labels}
			series={[{ category: props.labels[0] ?? "", values: props.values }]}
		/>
	),
	Select: ChatGenUISelect,
});
