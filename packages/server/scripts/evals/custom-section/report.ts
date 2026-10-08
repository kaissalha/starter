import { viewports } from "./render-checks";
import type { CaseResult } from "./run-case";

export type RunMeta = {
	commit: string;
	finishedAt: string;
	label: string;
	model: string;
	runId: string;
	startedAt: string;
};

const mean = (values: Array<number>) =>
	values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

const percentile = (values: Array<number>, fraction: number) => {
	const sorted = values.toSorted((a, b) => a - b);

	return sorted.length === 0
		? null
		: (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? null);
};

const rate = (hits: number, total: number) => (total === 0 ? null : hits / total);

export const aggregate = (results: Array<CaseResult>) => {
	const attempted = results.filter(({ composeAttempts }) => composeAttempts > 0);
	const composed = results.filter(({ status }) => status === "composed");
	const rendered = composed.filter(({ render }) => render !== null);
	const metrics = composed.flatMap(({ metrics: item }) => (item ? [item] : []));

	const perViewport = Object.fromEntries(
		viewports.map((width) => {
			const reports = rendered.flatMap(({ render }) => {
				const report = render?.[width];

				return report ? [report] : [];
			});

			const tested = reports.reduce((sum, { contrast }) => sum + contrast.tested, 0);
			const na = reports.reduce((sum, { contrast }) => sum + contrast.na, 0);
			const targets = reports.reduce((sum, { tapTargets }) => sum + tapTargets.total, 0);

			return [
				width,
				{
					brokenImageCases: rate(reports.filter(({ broken }) => broken.length > 0).length, reports.length),
					contrastNaShare: rate(na, tested + na),
					contrastViolationCases: rate(
						reports.filter(({ contrast }) => contrast.violations.length > 0).length,
						reports.length
					),
					emptyCollectionCases: rate(
						reports.filter(({ emptyCollections }) => emptyCollections > 0).length,
						reports.length
					),
					overflowCases: rate(reports.filter(({ overflow }) => overflow.length > 0).length, reports.length),
					pageOverflowCases: rate(reports.filter(({ pageOverflow }) => pageOverflow).length, reports.length),
					tapUnder44Share: rate(
						reports.reduce((sum, { tapTargets }) => sum + tapTargets.under44, 0),
						targets
					),
					textOverflowCases: rate(
						reports.filter(({ textOverflow }) => textOverflow.length > 0).length,
						reports.length
					),
				},
			];
		})
	);

	const traitCases = metrics.filter(({ traitsMet }) => traitsMet !== null);
	const primitives = new Map<string, number>();

	for (const { primitives: used } of metrics) {
		for (const type of Object.keys(used)) {
			primitives.set(type, (primitives.get(type) ?? 0) + 1);
		}
	}

	return {
		attempted: attempted.length,
		cases: results.length,
		catalog: results.filter(({ status }) => status === "catalog").length,
		composed: composed.length,
		costUsd: results.reduce((sum, { costUsd }) => sum + (costUsd ?? 0), 0),
		finalValidityOverAll: rate(composed.length, results.length),
		finalValidityOverAttempted: rate(composed.length, attempted.length),
		firstAttemptValidity: rate(
			attempted.filter(({ firstAttemptValid }) => firstAttemptValid).length,
			attempted.length
		),
		firstSchemaValidity: rate(
			attempted.filter(({ firstSchemaValid }) => firstSchemaValid).length,
			attempted.length
		),
		firstTurnComposed: rate(results.filter(({ firstTurnComposed }) => firstTurnComposed).length, results.length),
		latencyMs: {
			p50: percentile(
				results.map(({ latencyMs }) => latencyMs),
				0.5
			),
			p95: percentile(
				results.map(({ latencyMs }) => latencyMs),
				0.95
			),
		},
		meanAppearanceShare: mean(
			metrics.flatMap(({ appearanceShare }) => (appearanceShare === null ? [] : [appearanceShare]))
		),
		meanComposeAttempts: mean(attempted.map(({ composeAttempts }) => composeAttempts)),
		meanNodeCount: mean(metrics.map(({ nodeCount }) => nodeCount)),
		meanProcessorReplays: mean(attempted.map(({ processorReplays }) => processorReplays)),
		meanSpShare: mean(metrics.flatMap(({ spShare }) => (spShare === null ? [] : [spShare]))),
		meanTokens: {
			input: mean(results.map(({ tokens }) => tokens.input)),
			output: mean(results.map(({ tokens }) => tokens.output)),
		},
		noCompose: results.filter(({ status }) => status === "no-compose").length,
		placementFollowedSelection: rate(
			composed.filter(({ placement }) => placement?.followedSelection).length,
			composed.length
		),
		primitiveUsage: Object.fromEntries(
			[...primitives.entries()].map(([type, count]) => [type, rate(count, metrics.length)])
		),
		renderErrors: composed.filter(({ renderError }) => renderError !== null).length,
		toolErrorCases: rate(results.filter(({ failures }) => failures.length > 0).length, results.length),
		traitsMet: rate(traitCases.filter(({ traitsMet }) => traitsMet).length, traitCases.length),
		viewports: perViewport,
	};
};

export type Aggregate = ReturnType<typeof aggregate>;

export type MetricRow = {
	key: string;
	label: string;
	n: number;
	unit: "rate" | "seconds" | "usd" | "value";
	value: number | null;
};

export const metricRows = (stats: Aggregate): Array<MetricRow> => {
	const rateRow = (key: string, label: string, value: number | null, n: number): MetricRow => ({
		key,
		label,
		n,
		unit: "rate",
		value,
	});

	const valueRow = (
		key: string,
		label: string,
		item: number | null,
		n: number,
		unit: MetricRow["unit"] = "value"
	): MetricRow => ({ key, label, n, unit, value: item });

	return [
		rateRow("finalValidityOverAll", "final valid (of all cases)", stats.finalValidityOverAll, stats.cases),
		rateRow("catalogChosen", "chose catalog instead of compose", rate(stats.catalog, stats.cases), stats.cases),
		rateRow(
			"finalValidityOverAttempted",
			"final valid (of attempted)",
			stats.finalValidityOverAttempted,
			stats.attempted
		),
		rateRow("firstAttemptValidity", "first attempt accepted", stats.firstAttemptValidity, stats.attempted),
		rateRow("firstSchemaValidity", "first attempt schema-valid", stats.firstSchemaValidity, stats.attempted),
		rateRow("firstTurnComposed", "composed without clarification", stats.firstTurnComposed, stats.cases),
		valueRow(
			"meanProcessorReplays",
			"processor replays per attempted case",
			stats.meanProcessorReplays,
			stats.attempted
		),
		rateRow("toolErrorCases", "cases with a tool error", stats.toolErrorCases, stats.cases),
		valueRow(
			"latencyP50",
			"latency p50",
			stats.latencyMs.p50 === null ? null : stats.latencyMs.p50 / 1000,
			stats.cases,
			"seconds"
		),
		valueRow(
			"latencyP95",
			"latency p95",
			stats.latencyMs.p95 === null ? null : stats.latencyMs.p95 / 1000,
			stats.cases,
			"seconds"
		),
		valueRow("tokensIn", "mean input tokens", stats.meanTokens.input, stats.cases),
		valueRow("tokensOut", "mean output tokens", stats.meanTokens.output, stats.cases),
		valueRow(
			"costPerCase",
			"agent-model cost per case",
			stats.cases === 0 ? null : stats.costUsd / stats.cases,
			stats.cases,
			"usd"
		),
		rateRow("placement", "inserted at selected position", stats.placementFollowedSelection, stats.composed),
		rateRow("traits", "intent traits met", stats.traitsMet, stats.composed),
		valueRow("nodeCount", "mean node count", stats.meanNodeCount, stats.composed),
		rateRow("spShare", "lengths using sp", stats.meanSpShare, stats.composed),
		rateRow("appearanceShare", "text using appearance", stats.meanAppearanceShare, stats.composed),
		...Object.entries(stats.viewports).flatMap(([width, item]) => [
			rateRow(`contrast${width}`, `contrast violation at ${width}`, item.contrastViolationCases, stats.composed),
			rateRow(`overflow${width}`, `overflow at ${width}`, item.overflowCases, stats.composed),
			rateRow(`textOverflow${width}`, `text clipped at ${width}`, item.textOverflowCases, stats.composed),
			rateRow(`broken${width}`, `broken image at ${width}`, item.brokenImageCases, stats.composed),
			rateRow(`tapUnder44${width}`, `tap targets under 44px at ${width}`, item.tapUnder44Share, stats.composed),
			rateRow(`empty${width}`, `empty collection at ${width}`, item.emptyCollectionCases, stats.composed),
		]),
	];
};

const flag = (value: boolean | null | undefined) => {
	if (value === null || value === undefined) {
		return "-";
	}

	return value ? "y" : "n";
};

const pct = (value: number | null | undefined) =>
	value === null || value === undefined ? "n/a" : `${(value * 100).toFixed(0)}%`;

const num = (value: number | null | undefined, digits = 1) =>
	value === null || value === undefined ? "n/a" : value.toFixed(digits);

export const renderSummary = ({ meta, results }: { meta: RunMeta; results: Array<CaseResult> }) => {
	const stats = aggregate(results);

	const rows = results
		.toSorted((a, b) => a.id.localeCompare(b.id))
		.map(
			(item) =>
				`| ${item.id} | ${item.templateId} | ${item.status} | ${flag(item.firstAttemptValid)} | ${item.composeAttempts} | ${item.processorReplays} | ${item.failures.length} | ${(item.latencyMs / 1000).toFixed(0)}s | ${item.metrics?.nodeCount ?? "-"} | ${flag(item.metrics?.traitsMet)} |`
		);

	const viewportRows = viewports.map((width) => {
		const item = stats.viewports[width];

		return `| ${width} | ${pct(item?.contrastViolationCases)} | ${pct(item?.contrastNaShare)} | ${pct(item?.overflowCases)} | ${pct(item?.pageOverflowCases)} | ${pct(item?.textOverflowCases)} | ${pct(item?.brokenImageCases)} | ${pct(item?.tapUnder44Share)} | ${pct(item?.emptyCollectionCases)} |`;
	});

	return `# Custom-section eval: ${meta.label}

Run ${meta.runId}, commit ${meta.commit}, model ${meta.model}, ${meta.startedAt} to ${meta.finishedAt}.

## Generation

| metric | value |
| --- | --- |
| cases | ${stats.cases} |
| composed (final valid, materialized) | ${stats.composed} (${pct(stats.finalValidityOverAll)} of all, ${pct(stats.finalValidityOverAttempted)} of attempted) |
| chose a catalog section instead | ${stats.catalog} |
| no compose call (asked, declined, or answered in prose) | ${stats.noCompose} |
| composed attempt on first turn (else nudged: asked or answered in prose) | ${pct(stats.firstTurnComposed)} |
| first attempt accepted by processor | ${pct(stats.firstAttemptValidity)} |
| first attempt schema-valid | ${pct(stats.firstSchemaValidity)} |
| mean compose attempts / processor replays | ${num(stats.meanComposeAttempts, 2)} / ${num(stats.meanProcessorReplays, 2)} |
| cases with a tool error | ${pct(stats.toolErrorCases)} |
| latency p50 / p95 | ${num((stats.latencyMs.p50 ?? 0) / 1000, 0)}s / ${num((stats.latencyMs.p95 ?? 0) / 1000, 0)}s |
| mean tokens in / out | ${num(stats.meanTokens.input, 0)} / ${num(stats.meanTokens.output, 0)} |
| agent-model cost | $${stats.costUsd.toFixed(3)} |
| placement followed selection | ${pct(stats.placementFollowedSelection)} |
| intent traits met | ${pct(stats.traitsMet)} |

## Authored graph

| metric | value |
| --- | --- |
| mean node count | ${num(stats.meanNodeCount)} |
| lengths using sp | ${pct(stats.meanSpShare)} |
| text nodes using appearance | ${pct(stats.meanAppearanceShare)} |
| primitive usage (share of sections) | ${Object.entries(stats.primitiveUsage)
		.map(([type, share]) => `${type} ${pct(share)}`)
		.join(", ")} |

## Rendered checks (share of composed sections with at least one finding)

| viewport | contrast | contrast N/A (text) | overflow | page overflow | text clipped | broken img | tap under 44px (targets) | empty collection |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${viewportRows.join("\n")}

Contrast is skipped (N/A) when text sits over a background image, gradient, or overlapping media.

## Cases

| case | template | status | first ok | attempts | replays | tool errors | latency | nodes | traits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}
`;
};
