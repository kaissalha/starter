import { web } from "@e2e-dev/web";
import { gateway } from "ai";
import type { E2EConfig } from "e2e";

// oxlint-disable-next-line import/no-default-export -- The e2e runner loads this configuration through its default export.
export default {
	agents: { default: { model: gateway("openai/gpt-6-luna-fast") } },
	projectId: "starter",
	targets: [{ app: { url: "http://localhost:3100" }, engine: web() }],
	tests: ["**/*.e2e.ts", "!mobile/**"],
	workers: 1,
} satisfies E2EConfig;
