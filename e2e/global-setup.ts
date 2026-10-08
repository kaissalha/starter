import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { rm } from "node:fs/promises";
import { get, type IncomingMessage } from "node:http";
import { join } from "node:path";
import { text } from "node:stream/consumers";

const webappURL = "http://localhost:3100/en/login";

const websitesURL = "http://018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339.localhost:3101/";

const distDir = join(process.cwd(), "apps/webapp/.next-e2e");

const websitesDistDir = join(process.cwd(), "apps/websites/.next-e2e");

const stopServer = async (server: ChildProcess) => {
	if (server.exitCode !== null) {
		return;
	}

	server.kill("SIGTERM");

	await Promise.race([
		new Promise<void>((resolve) => server.once("exit", () => resolve())),
		new Promise<void>((resolve) => setTimeout(resolve, 5000)),
	]);

	if (server.exitCode === null) {
		server.kill("SIGKILL");
	}
};

const waitForServer = async (server: ChildProcess, url: string, readLogs: () => string) => {
	const deadline = Date.now() + 60_000;
	const lastResponseReference = { value: "No response received" };

	while (Date.now() < deadline) {
		if (server.exitCode !== null) {
			throw new Error(`E2E server exited with code ${server.exitCode}.\n${readLogs()}`);
		}

		try {
			const target = new URL(url);
			const host = target.host;
			target.hostname = "localhost";

			const response = await new Promise<IncomingMessage>((resolve, reject) => {
				get(target, { headers: { host } }, resolve).on("error", reject);
			});

			const body = await text(response);

			if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
				return;
			}

			lastResponseReference.value = `${response.statusCode} ${body}`.slice(0, 2000);
		} catch {}

		await new Promise((resolve) => setTimeout(resolve, 250));
	}

	throw new Error(`E2E server did not become ready.\n${lastResponseReference.value}\n${readLogs()}`);
};

// oxlint-disable-next-line import/no-default-export -- Playwright loads global setup through its default export.
export default async function globalSetup() {
	process.env.NODE_ENV = "test";
	process.env.AI_GATEWAY_API_KEY = "e2e-ai-gateway-key";
	const { setup: setupServices, teardown: teardownServices } = await import("../globalSetup");
	await setupServices();
	const { seedPublicWebsite } = await import("./fixtures/website");
	await seedPublicWebsite();
	const { pool: applicationPool } = await import("@starter/db");

	const teardown = async () => {
		await applicationPool.end();
		await teardownServices();
	};

	const styles =
		process.env.E2E_REUSE_STYLES === "1"
			? null
			: spawnSync("bun", ["run", "--cwd", "packages/infinite-website", "build"], {
					cwd: process.cwd(),
					encoding: "utf8",
				});

	if (styles && styles.status !== 0) {
		await teardown();
		throw new Error(`Website styles failed to build.\n${styles.stderr}`);
	}

	await rm(distDir, { force: true, recursive: true });
	await rm(websitesDistDir, { force: true, recursive: true });

	const webappLogs: Array<string> = [];
	const websitesLogs: Array<string> = [];

	const server = spawn(
		"node",
		["node_modules/next/dist/bin/next", "dev", "--hostname", "0.0.0.0", "--port", "3100"],
		{
			cwd: `${process.cwd()}/apps/webapp`,
			env: {
				...process.env,
				BETTER_AUTH_SECRET: "e2e-better-auth-secret-at-least-32-characters",
				NODE_ENV: "development",
				PLAYWRIGHT_TEST: "1",
				PORT: "3100",
				POSTHOG_PERSONAL_API_KEY: "e2e-posthog-key",
				POSTHOG_PROJECT_ID: "e2e-posthog-project",
				RESEND_KEY: "e2e-resend-key",
			},
			stdio: ["ignore", "pipe", "pipe"],
		}
	);

	const websites = spawn(
		"node",
		["node_modules/next/dist/bin/next", "dev", "--hostname", "0.0.0.0", "--port", "3101"],
		{
			cwd: `${process.cwd()}/apps/websites`,
			env: {
				...process.env,
				NODE_ENV: "development",
				PLAYWRIGHT_TEST: "1",
				PORT: "3101",
			},
			stdio: ["ignore", "pipe", "pipe"],
		}
	);

	const capture = (logs: Array<string>) => (chunk: Buffer) => {
		logs.push(chunk.toString());

		if (logs.length > 200) {
			logs.shift();
		}
	};

	server.stdout?.on("data", capture(webappLogs));
	server.stderr?.on("data", capture(webappLogs));
	websites.stdout?.on("data", capture(websitesLogs));
	websites.stderr?.on("data", capture(websitesLogs));

	try {
		await Promise.all([
			waitForServer(server, webappURL, () => webappLogs.join("")),
			waitForServer(websites, websitesURL, () => websitesLogs.join("")),
		]);
		await Promise.all(
			["/en/onboarding", "/en/dashboard", "/api/auth/get-session"].map((pathname) =>
				fetch(new URL(pathname, webappURL), {
					headers: { cookie: "better-auth.session_token=warmup" },
					redirect: "manual",
				})
			)
		);
	} catch (error) {
		await Promise.all([stopServer(server), stopServer(websites)]);
		await rm(distDir, { force: true, recursive: true });
		await rm(websitesDistDir, { force: true, recursive: true });
		await teardown();
		throw error;
	}

	return async () => {
		await Promise.all([stopServer(server), stopServer(websites)]);
		await rm(distDir, { force: true, recursive: true });
		await rm(websitesDistDir, { force: true, recursive: true });
		await teardown();
	};
}
