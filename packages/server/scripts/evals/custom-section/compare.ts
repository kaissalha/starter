import { gateway, generateText } from "ai";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { getPricing } from "./pricing";

const runFileSchema = z.looseObject({
	meta: z.looseObject({ commit: z.string(), label: z.string(), runId: z.string() }),
	results: z.array(
		z.looseObject({
			id: z.string(),
			intent: z.string(),
			request: z.string(),
			status: z.string(),
			templateId: z.string(),
		})
	),
	rows: z.array(
		z.object({
			key: z.string(),
			label: z.string(),
			n: z.number(),
			unit: z.enum(["rate", "seconds", "usd", "value"]),
			value: z.number().nullable(),
		})
	),
});

type Run = z.infer<typeof runFileSchema> & { dir: string };

export const loadRun = ({ outputRoot, ref }: { outputRoot: string; ref: string }): Run => {
	const dir = path.isAbsolute(ref) ? ref : path.join(outputRoot, ref);

	return { ...runFileSchema.parse(JSON.parse(readFileSync(path.join(dir, "results.json"), "utf8"))), dir };
};

const format = ({ unit, value }: { unit: "rate" | "seconds" | "usd" | "value"; value: number | null }) => {
	if (value === null) {
		return "n/a";
	}

	if (unit === "rate") {
		return `${(value * 100).toFixed(0)}%`;
	}

	if (unit === "usd") {
		return `$${value.toFixed(4)}`;
	}

	return unit === "seconds" ? `${value.toFixed(0)}s` : value.toFixed(value < 10 ? 2 : 0);
};

const halfWidth = ({ n, value }: { n: number; value: number | null }) =>
	value === null || n === 0 ? null : 1.96 * Math.sqrt((value * (1 - value)) / n);

type MetricRow = Run["rows"][number];

const describeDelta = ({ a, b }: { a: MetricRow; b: MetricRow }) => {
	if (a.value === null || b.value === null) {
		return "n/a";
	}

	return a.unit === "rate"
		? `${((b.value - a.value) * 100).toFixed(0)} pts`
		: format({ unit: a.unit, value: b.value - a.value });
};

const metricTable = ({ a, b }: { a: Run; b: Run }) => {
	const rows = a.rows.flatMap((rowA) => {
		const rowB = b.rows.find(({ key }) => key === rowA.key);

		if (!rowB) {
			return [];
		}

		const delta = describeDelta({ a: rowA, b: rowB });
		const noise = rowA.unit === "rate" ? halfWidth({ n: Math.min(rowA.n, rowB.n), value: rowB.value }) : null;

		return [
			`| ${rowA.label} | ${format(rowA)} (n=${rowA.n}) | ${format(rowB)} (n=${rowB.n}) | ${delta}${noise === null ? "" : ` (±${(noise * 100).toFixed(0)} pts noise)`} |`,
		];
	});

	return `| metric | A: ${a.meta.label} | B: ${b.meta.label} | B minus A |\n| --- | --- | --- | --- |\n${rows.join("\n")}`;
};

const forwardWinners = { FIRST: "a", SECOND: "b", TIE: "tie" } as const;

const swappedWinners = { FIRST: "b", SECOND: "a", TIE: "tie" } as const;

const judgeSchema = z.object({ reason: z.string().default(""), verdict: z.enum(["FIRST", "SECOND", "TIE"]) });

const judgeInstructions =
	'You compare two candidate custom sections that an AI added to the same website page. Judge only what a visitor sees: how well the section serves the request, hierarchy and polish, fit with the surrounding page, legibility, and how it holds up on mobile. Ignore image content; placeholder images are expected. The screenshots show the section in context (neighbors above and below) at desktop then mobile width. Reply with one line of JSON: {"verdict":"FIRST"|"SECOND"|"TIE","reason":"one short sentence"}.';

const parseVerdict = (text: string) => {
	try {
		return judgeSchema.safeParse(JSON.parse(/\{.*\}/su.exec(text)?.[0] ?? "")).data?.verdict ?? null;
	} catch {
		return null;
	}
};

const readImage = (file: string) => (existsSync(file) ? readFileSync(file) : null);

const imagesOf = ({ caseId, run }: { caseId: string; run: Run }) =>
	[1440, 390].flatMap((width) => {
		const image = readImage(path.join(run.dir, "cases", caseId, `context-${width}.png`));

		return image ? [{ image, type: "image" as const }] : [];
	});

const binomialTwoSided = ({ k, n }: { k: number; n: number }) => {
	const logChoose = (top: number, bottom: number) =>
		Array.from({ length: bottom }, (_, index) => Math.log((top - bottom + index + 1) / (index + 1))).reduce(
			(sum, value) => sum + value,
			0
		);

	const probabilities = Array.from({ length: n + 1 }, (_, successes) =>
		Math.exp(logChoose(n, successes) + n * Math.log(0.5))
	);

	const observed = probabilities[k] ?? 1;

	return Math.min(
		1,
		probabilities.filter((value) => value <= observed + 1e-12).reduce((sum, value) => sum + value, 0)
	);
};

const judgeOnce = async ({
	first,
	judgeModel,
	request,
	second,
	templateId,
}: {
	first: Array<{ image: Buffer; type: "image" }>;
	judgeModel: string;
	request: string;
	second: Array<{ image: Buffer; type: "image" }>;
	templateId: string;
}) => {
	const result = await generateText({
		messages: [
			{
				content: [
					{ text: `User request: "${request}" (template: ${templateId}).\n\nFIRST candidate:`, type: "text" },
					...first,
					{ text: "SECOND candidate:", type: "text" },
					...second,
				],
				role: "user",
			},
		],
		model: gateway(judgeModel),
		system: judgeInstructions,
	});

	return { usage: result.usage, verdict: parseVerdict(result.text) };
};

export const judgePairs = async ({
	a,
	b,
	judgeModel,
	maxUsd,
}: {
	a: Run;
	b: Run;
	judgeModel: string;
	maxUsd: number;
}) => {
	const pricing = await getPricing(judgeModel);

	const pairs = a.results.flatMap((resultA) => {
		const resultB = b.results.find(({ id }) => id === resultA.id);
		const imagesA = imagesOf({ caseId: resultA.id, run: a });
		const imagesB = imagesOf({ caseId: resultA.id, run: b });

		return resultA.status === "composed" &&
			resultB?.status === "composed" &&
			imagesA.length > 0 &&
			imagesB.length > 0
			? [{ imagesA, imagesB, resultA }]
			: [];
	});

	const tally = { a: 0, b: 0, inconsistent: 0, skipped: 0, tie: 0 };
	const state = { spent: 0 };

	for (const { imagesA, imagesB, resultA } of pairs) {
		if (state.spent >= maxUsd) {
			tally.skipped += 1;
			continue;
		}

		const common = { judgeModel, request: resultA.request, templateId: resultA.templateId };

		const [forward, swapped] = await Promise.all([
			judgeOnce({ ...common, first: imagesA, second: imagesB }),
			judgeOnce({ ...common, first: imagesB, second: imagesA }),
		]);

		for (const { usage } of [forward, swapped]) {
			state.spent +=
				(usage.inputTokens ?? 0) * (pricing?.input ?? 0) + (usage.outputTokens ?? 0) * (pricing?.output ?? 0);
		}

		const forwardWinner = forwardWinners[forward.verdict ?? "TIE"];
		const swappedWinner = swappedWinners[swapped.verdict ?? "TIE"];

		if (forward.verdict === null || swapped.verdict === null) {
			tally.skipped += 1;
		} else if (forwardWinner === swappedWinner && forwardWinner !== "tie") {
			tally[forwardWinner] += 1;
		} else if (forwardWinner === "tie" || swappedWinner === "tie" || forwardWinner === swappedWinner) {
			tally.tie += 1;
		} else {
			tally.inconsistent += 1;
		}
	}

	const decided = tally.a + tally.b;
	const judged = tally.a + tally.b + tally.tie + tally.inconsistent;

	return {
		judged,
		judgeModel,
		pairs: pairs.length,
		pValue: binomialTwoSided({ k: tally.a, n: decided }),
		spentUsd: state.spent,
		tally,
		winRateB: decided === 0 ? null : tally.b / decided,
	};
};

const judgeSection = (judge: Awaited<ReturnType<typeof judgePairs>>) =>
	`## Pairwise judge (${judge.judgeModel}, order-swapped, suite level only)

- candidate pairs where both runs composed: ${judge.pairs}; judged: ${judge.judged}; skipped (budget or unparsable): ${judge.tally.skipped}
- B wins ${judge.tally.b}, A wins ${judge.tally.a}, ties ${judge.tally.tie}, order-inconsistent (counted as no preference) ${judge.tally.inconsistent}
- B win rate among decided pairs: ${judge.winRateB === null ? "n/a" : `${(judge.winRateB * 100).toFixed(0)}%`} (sign test p=${judge.pValue.toFixed(3)}, n=${judge.tally.a + judge.tally.b})
- judge spend: $${judge.spentUsd.toFixed(3)}
- noise note: ${judge.judged < 30 ? "fewer than 30 judged pairs; treat the win rate as directional only and do not gate on it. " : ""}Pairs are not independent of the model's sampling noise; rerun both runs before trusting a small gap. Per-case verdicts are intentionally not reported.
`;

export const compareRuns = async ({
	a,
	b,
	judge,
	outputRoot,
}: {
	a: Run;
	b: Run;
	judge: { enabled: boolean; judgeModel: string; maxUsd: number };
	outputRoot: string;
}) => {
	const verdict = judge.enabled
		? await judgePairs({ a, b, judgeModel: judge.judgeModel, maxUsd: judge.maxUsd })
		: null;

	const markdown = `# Custom-section comparison

A: ${a.meta.label} (${a.meta.runId}, commit ${a.meta.commit})
B: ${b.meta.label} (${b.meta.runId}, commit ${b.meta.commit})

Rates are shares of the stated n. Differences smaller than the noise half-width are not distinguishable at this suite size; both runs sample a stochastic model.

${metricTable({ a, b })}

${verdict ? judgeSection(verdict) : "Judge not run (pass --judge)."}
`;

	const outDir = path.join(outputRoot, `compare-${a.meta.runId}-vs-${b.meta.runId}`);
	mkdirSync(outDir, { recursive: true });
	writeFileSync(path.join(outDir, "compare.md"), markdown);
	writeFileSync(path.join(outDir, "compare.json"), JSON.stringify({ a: a.meta, b: b.meta, judge: verdict }, null, 2));

	return { markdown, outDir };
};
