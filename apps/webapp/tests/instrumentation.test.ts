/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	assertRequiredConfig: vi.fn(),
	createDevTools: vi.fn(() => ({ onStart: vi.fn() })),
	registerEvlog: vi.fn(),
	registerOTel: vi.fn(),
	registerTelemetry: vi.fn(),
}));

vi.mock("@posthog/next", () => ({ createOnRequestError: vi.fn() }));

vi.mock("@vercel/otel", () => ({ registerOTel: mocks.registerOTel }));

vi.mock("@starter/observability", () => ({
	assertRequiredConfig: mocks.assertRequiredConfig,
	createEvlogOptions: () => ({}),
}));

vi.mock("evlog/next/instrumentation/create", () => ({
	createInstrumentation: () => ({ onRequestError: vi.fn(), register: mocks.registerEvlog }),
}));

vi.mock("ai", () => ({ registerTelemetry: mocks.registerTelemetry }));

vi.mock("@ai-sdk/devtools", () => ({ DevToolsTelemetry: mocks.createDevTools }));

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.stubEnv("NEXT_RUNTIME", "nodejs");
});

afterEach(() => vi.unstubAllEnvs());

describe("AI SDK DevTools instrumentation", () => {
	it("registers capture during Node development alongside existing instrumentation", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const { register } = await import("../src/instrumentation");
		await register();
		expect(mocks.createDevTools).toHaveBeenCalledOnce();
		expect(mocks.registerTelemetry).toHaveBeenCalledWith(mocks.createDevTools.mock.results[0]?.value);
		expect(mocks.registerOTel).toHaveBeenCalledWith({ serviceName: "webapp" });
		expect(mocks.registerEvlog).toHaveBeenCalledOnce();
	});

	it.each([
		["production", "nodejs", 1],
		["test", "nodejs", 1],
		["development", "edge", 0],
	] as const)("does not enable capture in %s / %s", async (environment, runtime, evlogCalls) => {
		vi.stubEnv("NODE_ENV", environment);
		vi.stubEnv("NEXT_RUNTIME", runtime);
		const { register } = await import("../src/instrumentation");
		await register();
		expect(mocks.createDevTools).not.toHaveBeenCalled();
		expect(mocks.registerTelemetry).not.toHaveBeenCalled();
		expect(mocks.registerEvlog).toHaveBeenCalledTimes(evlogCalls);
	});
});

describe("production configuration check", () => {
	it("runs once after the evlog logger is registered in the Node runtime", async () => {
		const { register } = await import("../src/instrumentation");
		await register();
		expect(mocks.assertRequiredConfig).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ app: "webapp", enforce: false })
		);
		expect(mocks.assertRequiredConfig.mock.invocationCallOrder[0]).toBeGreaterThan(
			mocks.registerEvlog.mock.invocationCallOrder[0] ?? Infinity
		);
	});

	it("does not run in the edge runtime", async () => {
		vi.stubEnv("NEXT_RUNTIME", "edge");
		const { register } = await import("../src/instrumentation");
		await register();
		expect(mocks.assertRequiredConfig).not.toHaveBeenCalled();
	});
});
