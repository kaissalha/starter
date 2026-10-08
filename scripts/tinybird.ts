import { TinybirdApi } from "@tinybirdco/sdk";
import { runBuild } from "@tinybirdco/sdk/cli/commands/build";
import { execFile } from "node:child_process";
import { mkdir, writeFile, appendFile, watch } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { z } from "zod";

const command = z.enum(["dev", "preview", "sync", "clean", "check", "deploy"]).parse(process.argv[2]);

const baseUrl = z.url().parse(process.env.TINYBIRD_URL);

const token = z.string().min(1).parse(process.env.TINYBIRD_TOKEN);

const api = new TinybirdApi({ baseUrl, token });

const cwd = new URL("../packages/analytics/", import.meta.url).pathname;

const credentialsDir = new URL("../.tinybird/", import.meta.url).pathname;

const branchSchema = z.object({ id: z.string(), name: z.string(), token: z.string() });

const getBranch = async (name: string) => {
	const { environments } = z
		.object({ environments: z.array(branchSchema) })
		.parse(await api.requestJson("/v1/environments"));

	return environments.find((branch) => branch.name === name);
};

const provisionBranch = async (name: string) => {
	const existing = await getBranch(name);

	if (existing) {
		return existing;
	}

	if (command !== "preview") {
		throw new Error("Branch missing. Run make tinybird-preview explicitly first.");
	}

	const result = z
		.object({ job: z.object({ id: z.string() }) })
		.parse(await api.requestJson(`/v1/environments?name=${name}`, { method: "POST" }));

	for (const _attempt of Array.from({ length: 60 })) {
		const job = z.object({ status: z.string() }).parse(await api.requestJson(`/v0/jobs/${result.job.id}`));

		if (job.status === "done") {
			const branch = await getBranch(name);

			if (branch) {
				return branch;
			}
		}

		if (job.status === "error" || job.status === "cancelled") {
			throw new Error("Tinybird branch provisioning failed.");
		}

		await setTimeout(1000);
	}

	throw new Error("Tinybird branch provisioning timed out.");
};

const exportCredentials = async (branchToken: string) => {
	const branchApi = new TinybirdApi({ baseUrl, token: branchToken });

	const result = z
		.object({ tokens: z.array(z.object({ name: z.string(), token: z.string().optional() })) })
		.parse(await branchApi.requestJson("/v0/tokens/"));

	const tokens = new Map(result.tokens.map((entry) => [entry.name, entry.token]));
	await mkdir(credentialsDir, { mode: 0o700, recursive: true });

	for (const [file, tokenName, variable] of [
		["collection", "analytics_append", "TINYBIRD_APPEND_TOKEN"],
		["reporting", "analytics_read", "TINYBIRD_READ_TOKEN"],
	] as const) {
		const scoped = tokens.get(tokenName);

		if (!scoped) {
			throw new Error(`Missing ${tokenName} token. Resource synchronization must succeed first.`);
		}

		if (process.env.GITHUB_ENV) {
			process.stdout.write(`::add-mask::${scoped}\n`);
		}

		await writeFile(`${credentialsDir}${file}.env`, `TINYBIRD_URL=${baseUrl}\n${variable}=${scoped}\n`, {
			mode: 0o600,
		});
	}

	await writeFile(`${credentialsDir}testing.env`, `TINYBIRD_URL=${baseUrl}\nTINYBIRD_TEST_TOKEN=${branchToken}\n`, {
		mode: 0o600,
	});

	if (process.env.GITHUB_ENV) {
		process.stdout.write(`::add-mask::${branchToken}\n`);
		await appendFile(process.env.GITHUB_ENV, `TINYBIRD_URL=${baseUrl}\nTINYBIRD_TEST_TOKEN=${branchToken}\n`);
	}
};

const watchBranch = async (branchToken: string) => {
	for await (const event of watch(`${cwd}src`)) {
		if (event.filename !== "resources.ts" && event.filename !== "endpoints.ts") {
			continue;
		}

		const updated = await runBuild({ cwd, devModeOverride: "branch", tokenOverride: branchToken });

		if (!updated.success) {
			throw new Error(updated.error ?? "Tinybird synchronization failed.");
		}

		process.stdout.write("Tinybird resources synchronized.\n");
	}
};

if (command === "check" || command === "deploy") {
	await promisify(execFile)(
		process.execPath,
		[`${cwd}node_modules/@tinybirdco/sdk/bin/tinybird.js`, "deploy", ...(command === "check" ? ["--check"] : [])],
		{ cwd }
	);
	process.stdout.write(`Tinybird production ${command} succeeded.\n`);
} else {
	const name = z
		.string()
		.regex(/^(?:dev|starter_pr_\d+|starter_dev_[a-zA-Z0-9_]+|codex_analytics_[a-zA-Z0-9_]+)$/u)
		.parse(process.argv[3] ?? process.env.TINYBIRD_BRANCH_NAME);

	if (name.startsWith("starter_pr_") && process.env.CI !== "true") {
		throw new Error("CI owns PR branches.");
	}

	if (command === "clean") {
		const branch = await getBranch(name);

		if (!branch) {
			process.exit(0);
		}

		const response = await api.request(`/v0/environments/${branch.id}`, { method: "DELETE" });

		if (!response.ok) {
			throw new Error(`Tinybird branch deletion failed (${response.status}).`);
		}
	} else {
		const branch = await provisionBranch(name);
		const branchApi = new TinybirdApi({ baseUrl, token: branch.token });
		z.object({ is_branch: z.literal(true) }).parse(await branchApi.requestJson("/v1/workspace"));
		const result = await runBuild({ cwd, devModeOverride: "branch", tokenOverride: branch.token });

		if (!result.success) {
			throw new Error(result.error ?? "Tinybird resource synchronization failed.");
		}

		await exportCredentials(branch.token);

		if (command === "dev") {
			await watchBranch(branch.token);
		}
	}

	process.stdout.write(`Tinybird ${command} succeeded for ${name}.\n`);
}
