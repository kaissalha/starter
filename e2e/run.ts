import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import globalSetup from "./global-setup";

const envFile = "apps/webapp/.env";

const localEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};

const modelEnv = {
	AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY ?? localEnv.AI_GATEWAY_API_KEY,
	VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN ?? localEnv.VERCEL_OIDC_TOKEN,
};

const teardown = await globalSetup();

const { status } = spawnSync("e2e", ["run", ...process.argv.slice(2)], {
	env: { ...process.env, ...modelEnv },
	stdio: "inherit",
});

await teardown();

process.exit(status ?? 1);
