import { spawn, type ChildProcess } from "node:child_process";
import { rm } from "node:fs/promises";
import { get, type IncomingMessage } from "node:http";
import { join } from "node:path";
import { text } from "node:stream/consumers";

const webappURL = "http://localhost:3100/en/login";

const distDir = join(process.cwd(), "apps/webapp/.next-e2e");

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
	const { pool: applicationPool } = await import("@starter/db");

	const teardown = async () => {
		await applicationPool.end();
		await teardownServices();
	};

	await rm(distDir, { force: true, recursive: true });

	const webappLogs: Array<string> = [];

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

	const capture = (logs: Array<string>) => (chunk: Buffer) => {
		logs.push(chunk.toString());

		if (logs.length > 200) {
			logs.shift();
		}
	};

	server.stdout?.on("data", capture(webappLogs));
	server.stderr?.on("data", capture(webappLogs));

	try {
		await waitForServer(server, webappURL, () => webappLogs.join(""));
		await Promise.all(
			["/en/onboarding", "/en/dashboard", "/api/auth/get-session"].map((pathname) =>
				fetch(new URL(pathname, webappURL), {
					headers: { cookie: "better-auth.session_token=warmup" },
					redirect: "manual",
				})
			)
		);
	} catch (error) {
		await stopServer(server);
		await rm(distDir, { force: true, recursive: true });
		await teardown();
		throw error;
	}

	return async () => {
		await stopServer(server);
		await rm(distDir, { force: true, recursive: true });
		await teardown();
	};
}
