import { spawnSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";

import { compareRuns, loadRun } from "./compare";
import { readGatewayKey } from "./gateway-key";

const serverDirectory = path.resolve(import.meta.dirname, "../../..");

const defaultOutput = path.join(serverDirectory, ".evals/custom-section");

const usage = `usage:
  eval:custom-section run [--label name] [--run-id id] [--cases ids-or-intents] [--limit n] [--concurrency n] [--output-dir dir]
  eval:custom-section compare <runA> <runB> [--judge] [--max-usd 3] [--judge-model anthropic/claude-opus-5.5] [--output-dir dir]`;

const [command, ...rest] = process.argv.slice(2);

const { positionals, values } = parseArgs({
	allowPositionals: true,
	args: rest,
	options: {
		cases: { type: "string" },
		concurrency: { type: "string" },
		judge: { type: "boolean" },
		"judge-model": { type: "string" },
		label: { type: "string" },
		limit: { type: "string" },
		"max-usd": { type: "string" },
		"output-dir": { type: "string" },
		"run-id": { type: "string" },
	},
});

const outputRoot = values["output-dir"] ?? defaultOutput;

if (command === "run") {
	const key = readGatewayKey();

	if (!key) {
		throw new Error("AI_GATEWAY_API_KEY is not set and apps/webapp/.env.local has none");
	}

	const result = spawnSync("bunx", ["vitest", "run", "--config", "vitest.eval.config.mts"], {
		cwd: serverDirectory,
		env: {
			...process.env,
			AI_GATEWAY_API_KEY: key,
			EVAL_CASES: values.cases ?? "",
			EVAL_CONCURRENCY: values.concurrency ?? "4",
			EVAL_LABEL: values.label ?? "run",
			EVAL_LIMIT: values.limit ?? "",
			EVAL_OUTPUT_DIR: outputRoot,
			EVAL_RUN_ID: values["run-id"] ?? "",
		},
		stdio: "inherit",
	});

	process.exit(result.status ?? 1);
} else if (command === "compare") {
	const [refA, refB] = positionals;

	if (!refA || !refB) {
		throw new Error(usage);
	}

	if (values.judge && !process.env.AI_GATEWAY_API_KEY) {
		process.env.AI_GATEWAY_API_KEY = readGatewayKey();
	}

	const { markdown, outDir } = await compareRuns({
		a: loadRun({ outputRoot, ref: refA }),
		b: loadRun({ outputRoot, ref: refB }),
		judge: {
			enabled: values.judge === true,
			judgeModel: values["judge-model"] ?? "anthropic/claude-opus-5.5",
			maxUsd: Number(values["max-usd"] ?? 3),
		},
		outputRoot,
	});

	process.stdout.write(`${markdown}\nwritten to ${outDir}\n`);
} else {
	process.stdout.write(`${usage}\n`);
	process.exit(1);
}
