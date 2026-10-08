import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

import { corpus } from "./corpus";
import { aggregate, metricRows, renderSummary } from "./report";
import { authoringModelId, closeBrowser, runCase, type CaseResult } from "./run-case";

vi.mock("../../../src/services/websites/service", async (importOriginal) => ({
	...(await importOriginal<object>()),
	...(await import("./in-memory-website")).websiteServiceOverrides,
}));

vi.mock("../../../src/services/permissions", async (importOriginal) => ({
	...(await importOriginal<object>()),
	requireOrganizationPermission: async () => "owner",
}));

vi.mock("../../../src/services/websites/permissions", async (importOriginal) => ({
	...(await importOriginal<object>()),
	requireWebsiteEditPermission: async () => undefined,
}));

vi.mock("../../../src/services/websites/assets", async (importOriginal) => ({
	...(await importOriginal<object>()),
	resolveWebsiteAuthoringMedia: (await import("./in-memory-website")).resolveWebsiteAuthoringMedia,
}));

vi.mock("../../../src/mastra/memory", async () => ({
	createDashboardWorkingMemoryProcessor: async () => ({ id: "eval-noop-memory" }),
	dashboardChatMemory: undefined,
	mastraStorage: undefined,
}));

const startedAt = new Date().toISOString();

const runId = process.env.EVAL_RUN_ID || startedAt.replaceAll(/[:.]/gu, "-");

const label = process.env.EVAL_LABEL || "run";

const filter = (process.env.EVAL_CASES ?? "").split(",").filter(Boolean);

const limit = Number(process.env.EVAL_LIMIT || corpus.length);

const outputRoot = process.env.EVAL_OUTPUT_DIR || path.resolve(import.meta.dirname, "../../../.evals/custom-section");

const runDir = path.join(outputRoot, runId);

const selected = corpus
	.filter(({ id, intent }) => filter.length === 0 || filter.some((term) => id.includes(term) || intent === term))
	.slice(0, limit);

const results: Array<CaseResult> = [];

const gitCommit = () => {
	try {
		return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
	} catch {
		return "unknown";
	}
};

describe("custom section composition", () => {
	afterAll(async () => {
		await closeBrowser();
		mkdirSync(runDir, { recursive: true });

		const meta = {
			commit: gitCommit(),
			finishedAt: new Date().toISOString(),
			label,
			model: authoringModelId,
			runId,
			startedAt,
		};

		const stats = aggregate(results);
		writeFileSync(
			path.join(runDir, "results.json"),
			JSON.stringify({ aggregate: stats, meta, results, rows: metricRows(stats) }, null, 2)
		);
		writeFileSync(path.join(runDir, "summary.md"), renderSummary({ meta, results }));
		process.stderr.write(`\ncustom-section eval written to ${runDir}\n`);
	});

	it.concurrent.for(selected)("$id", async (evalCase) => {
		const result = await runCase({ evalCase, runDir });
		results.push(result);
		expect(result.id).toBe(evalCase.id);
	});
});
