import { z } from "zod";

import {
	hasOpenUIVisibleContent,
	normalizeOpenUIIdentityText,
	normalizeOpenUIVisibleText,
	OPENUI_CHART_MAGNITUDE_LIMIT,
} from "@starter/genui/text";

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

export const normalizeGenUIChartData = (labels: GenUIInput, series: GenUIInput): GenUIChartData => {
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

export const prepareSpectrumChartData = (rawLabels: GenUIInput, rawSeries: GenUIInput) => {
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
