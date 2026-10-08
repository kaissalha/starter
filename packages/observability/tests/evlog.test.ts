import { trace } from "@opentelemetry/api";
import { log, type WideEvent } from "evlog";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assertRequiredConfig, createEvlogOptions, serializeLogError } from "../src";

vi.mock("evlog", async (importOriginal) => ({
	...(await importOriginal<typeof import("evlog")>()),
	log: { error: vi.fn(), warn: vi.fn() },
}));

const requiredNames = ["BETTER_AUTH_SECRET", "CRON_SECRET", "DATABASE_URL", "REDIS_URL", "WEBSITES_PLATFORM_DOMAIN"];

afterEach(() => {
	vi.unstubAllEnvs();
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

const stubConfig = ({ unset = [], vercelEnv }: { unset?: Array<string>; vercelEnv: string }) => {
	vi.stubEnv("VERCEL_ENV", vercelEnv);

	for (const name of requiredNames) {
		vi.stubEnv(name, unset.includes(name) ? undefined : "x");
	}
};

describe("createEvlogOptions", () => {
	it("samples info events in production", async () => {
		vi.stubEnv("VERCEL_ENV", "production");
		vi.resetModules();
		const { createEvlogOptions: create } = await import("../src");

		expect(create("webapp").sampling).toEqual({ keep: [{ duration: 2000 }, { status: 400 }], rates: { info: 10 } });
	});

	it("does not sample in development", async () => {
		vi.stubEnv("VERCEL_ENV", undefined);
		vi.stubEnv("NODE_ENV", "development");
		vi.resetModules();
		const { createEvlogOptions: create } = await import("../src");

		expect(create("webapp").sampling).toBeUndefined();
	});

	it("always keeps cron events", () => {
		const cron = { context: { cron: {} }, shouldKeep: false };
		const other = { context: {}, shouldKeep: false };
		const options = createEvlogOptions("webapp");
		options.keep(cron);
		options.keep(other);

		expect(cron.shouldKeep).toBe(true);
		expect(other.shouldKeep).toBe(false);
	});

	it("records the active OpenTelemetry span on events", () => {
		const plugin = createEvlogOptions("webapp").plugins.find(({ name }) => name === "otel-trace-context");
		const spanContext = { spanId: "00f067aa0ba902b7", traceFlags: 1, traceId: "4bf92f3577b34da6a3ce929d0e0e4736" };
		const event: WideEvent = { environment: "test", level: "info", service: "webapp", timestamp: "" };
		vi.spyOn(trace, "getActiveSpan").mockReturnValue(trace.wrapSpanContext(spanContext));
		plugin?.enrich?.({ event });

		expect(event).toMatchObject({ spanId: spanContext.spanId, traceId: spanContext.traceId });
	});

	it("links events to the PostHog person and session from tracing headers", () => {
		const plugin = createEvlogOptions("webapp").plugins.find(({ name }) => name === "posthog-tracing");
		const event: WideEvent = { environment: "test", level: "info", service: "webapp", timestamp: "" };
		plugin?.enrich?.({
			event,
			headers: { "x-posthog-distinct-id": "user_1", "x-posthog-session-id": "session_1" },
		});

		expect(event.posthog).toEqual({ distinctId: "user_1", sessionId: "session_1" });
	});

	it("prefers the authenticated user over the browser PostHog id", () => {
		const plugin = createEvlogOptions("webapp").plugins.find(({ name }) => name === "posthog-tracing");

		const event: WideEvent = {
			environment: "test",
			level: "info",
			service: "webapp",
			timestamp: "",
			userId: "user_2",
		};

		plugin?.enrich?.({ event, headers: { "x-posthog-distinct-id": "anonymous_1" } });

		expect(event.posthog).toEqual({ distinctId: "user_2", sessionId: undefined });
	});
});

describe("serializeLogError", () => {
	it("keeps message, name, stack and codes through JSON serialization", () => {
		const error = Object.assign(new Error("boom"), { code: "ECONNRESET" });
		const json = JSON.stringify({ error: serializeLogError(error) });
		expect(json).toContain('"message":"boom"');
		expect(json).toContain('"code":"ECONNRESET"');
		expect(serializeLogError(error).stack).toEqual(expect.any(String));
		expect(serializeLogError(Object.assign(new Error("a"), { code: {} })).code).toBeUndefined();
	});

	it("serializes cause chains up to depth 3", () => {
		const error = [5, 4, 3, 2, 1, 0].reduce(
			(cause, level) => new Error(`level-${level}`, { cause }),
			new Error("level-6")
		);

		const json = JSON.stringify(serializeLogError(error));
		expect(json).toContain("level-3");
		expect(json).not.toContain("level-4");
	});

	it("wraps non-Error throwables without throwing", () => {
		expect(serializeLogError("plain")).toEqual({ message: "plain", name: "NonError" });
		expect(serializeLogError({ message: "resend failed", name: "validation_error" })).toEqual({
			message: "resend failed",
			name: "validation_error",
		});
		expect(serializeLogError(null)).toEqual({ message: "null", name: "NonError" });
	});
});

describe("assertRequiredConfig", () => {
	it("logs nothing when everything is set", async () => {
		stubConfig({ vercelEnv: "production" });
		await expect(
			assertRequiredConfig({ app: "webapp", enforce: true, names: requiredNames })
		).resolves.toBeUndefined();
		expect(log.warn).not.toHaveBeenCalled();
		expect(log.error).not.toHaveBeenCalled();
	});

	it("warns without throwing outside production", async () => {
		stubConfig({ unset: ["REDIS_URL"], vercelEnv: "preview" });
		await expect(
			assertRequiredConfig({ app: "webapp", enforce: true, names: requiredNames })
		).resolves.toBeUndefined();
		expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ missing: ["REDIS_URL"] }));
		expect(log.error).not.toHaveBeenCalled();
	});

	it("logs an error in production and throws names only when enforced", async () => {
		stubConfig({ unset: ["REDIS_URL"], vercelEnv: "production" });
		vi.stubEnv("DATABASE_URL", "sentinel-secret-value");
		await expect(
			assertRequiredConfig({ app: "webapp", enforce: false, names: requiredNames })
		).resolves.toBeUndefined();
		expect(log.error).toHaveBeenCalledWith(expect.objectContaining({ missing: ["REDIS_URL"] }));
		const failure = assertRequiredConfig({ app: "webapp", enforce: true, names: requiredNames });
		await expect(failure).rejects.toThrow("REDIS_URL");
		await expect(failure).rejects.not.toThrow("sentinel-secret-value");
	});
});
