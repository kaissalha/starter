import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ error: vi.fn(), set: vi.fn(), warn: vi.fn() }));

vi.mock("evlog/next", () => ({
	createEvlog: () => ({
		createError: vi.fn(),
		log: vi.fn(),
		useLogger: () => ({ error: mocks.error, set: mocks.set, warn: mocks.warn }),
		withEvlog: vi.fn(),
	}),
}));

vi.mock("@starter/observability", () => ({ createEvlogOptions: () => ({}) }));

import { logProcedureErrors, withCronLog } from "@/lib/evlog";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("logProcedureErrors", () => {
	it("passes results through", async () => {
		await expect(logProcedureErrors({ next: async () => "ok" })).resolves.toBe("ok");
		expect(mocks.error).not.toHaveBeenCalled();
	});

	it("keeps expected 4xx procedure errors out of error events", async () => {
		const error = new ORPCError("NOT_FOUND");
		await expect(
			logProcedureErrors({
				next: async () => {
					throw error;
				},
			})
		).rejects.toBe(error);
		expect(mocks.set).toHaveBeenCalledWith({ rpc: { errorCode: "NOT_FOUND" } });
		expect(mocks.error).not.toHaveBeenCalled();
	});

	it("logs server and unexpected errors", async () => {
		const server = new ORPCError("INTERNAL_SERVER_ERROR");
		await expect(
			logProcedureErrors({
				next: async () => {
					throw server;
				},
			})
		).rejects.toBe(server);
		expect(mocks.error).toHaveBeenLastCalledWith(server);

		const plain = new Error("db");
		await expect(
			logProcedureErrors({
				next: async () => {
					throw plain;
				},
			})
		).rejects.toBe(plain);
		expect(mocks.error).toHaveBeenLastCalledWith(plain);

		await expect(
			logProcedureErrors({
				next: async () => {
					// oxlint-disable-next-line no-throw-literal -- verifies non-Error throwables
					throw "text";
				},
			})
		).rejects.toBe("text");
		expect(mocks.error).toHaveBeenLastCalledWith(expect.any(Error));
	});
});

describe("withCronLog", () => {
	const request = new Request("https://starter.example/api/events/dispatch");

	it("records numeric counters and status", async () => {
		const response = await withCronLog(async () => Response.json({ expanded: 2, started: 1 }))(request);

		expect(mocks.set).toHaveBeenCalledWith({ cron: { result: { expanded: 2, started: 1 }, status: 200 } });
		await expect(response.json()).resolves.toEqual({ expanded: 2, started: 1 });
	});

	it("omits the result for non-numeric or non-JSON bodies", async () => {
		await withCronLog(async () => Response.json({ ok: "yes" }))(request);
		await withCronLog(async () => new Response("done"))(request);

		expect(mocks.set).toHaveBeenNthCalledWith(1, { cron: { result: undefined, status: 200 } });
		expect(mocks.set).toHaveBeenNthCalledWith(2, { cron: { result: undefined, status: 200 } });
	});

	it("warns on unauthorized calls", async () => {
		const response = await withCronLog(async () => Response.json({ error: "unauthorized" }, { status: 401 }))(
			request
		);

		expect(response.status).toBe(401);
		expect(mocks.warn).toHaveBeenCalledWith("Cron request rejected as unauthorized", { cron: { status: 401 } });
		expect(mocks.set).not.toHaveBeenCalled();
	});
});
