import path from "node:path";
import { defineConfig } from "vitest/config";

import { readGatewayKey } from "./scripts/evals/custom-section/gateway-key";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
	oxc: { jsx: { runtime: "automatic" } },
	resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
	test: {
		env: { AI_GATEWAY_API_KEY: readGatewayKey() ?? "" },
		environment: "node",
		fileParallelism: false,
		hookTimeout: 120_000,
		include: ["scripts/evals/custom-section/*.eval.ts"],
		maxConcurrency: Number(process.env.EVAL_CONCURRENCY ?? 4),
		testTimeout: 900_000,
	},
});
