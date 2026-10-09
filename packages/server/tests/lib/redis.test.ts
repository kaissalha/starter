import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createRedisClient: vi.fn(), eval: vi.fn(), warn: vi.fn() }));

vi.mock("@starter/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("@starter/cache")>()),
	createRedisClient: mocks.createRedisClient,
}));

vi.mock("@starter/observability", () => ({ log: { warn: mocks.warn }, serializeLogError: (error: Error) => error }));

import { checkRateLimit, getRedis } from "../../src/lib/redis";

beforeEach(() => {
	vi.clearAllMocks();
	process.env.REDIS_URL = "redis://localhost:6379";
	mocks.createRedisClient.mockImplementation(() => ({
		eval: mocks.eval,
		on: vi.fn().mockReturnThis(),
		status: "ready",
	}));
	mocks.eval.mockResolvedValue([1, 30_000]);
});

describe("getRedis", () => {
	it("returns null when Redis is not configured", () => {
		delete process.env.REDIS_URL;

		expect(getRedis()).toBeNull();
	});

	it("reuses one fail-fast client and replaces it once the connection ends", () => {
		const client = getRedis();

		expect(getRedis()).toBe(client);
		expect(mocks.createRedisClient).toHaveBeenCalledWith("redis://localhost:6379", {
			commandTimeout: 300,
			connectTimeout: 300,
			maxRetriesPerRequest: 0,
		});

		Object.assign(client ?? {}, { status: "end" });

		expect(getRedis()).not.toBe(client);
	});
});

describe("checkRateLimit", () => {
	it("allows without touching Redis when it is not configured", async () => {
		delete process.env.REDIS_URL;

		await expect(checkRateLimit({ key: "a", max: 1, windowSeconds: 1 })).resolves.toEqual({
			allowed: true,
			retryAfterSeconds: 0,
		});
		expect(mocks.eval).not.toHaveBeenCalled();
	});

	it("namespaces the key and returns the shared decision", async () => {
		mocks.eval.mockResolvedValue([3, 7000]);

		await expect(checkRateLimit({ key: "a:b", max: 2, windowSeconds: 30 })).resolves.toEqual({
			allowed: false,
			retryAfterSeconds: 7,
		});
		expect(mocks.eval).toHaveBeenCalledWith(expect.any(String), 1, "ratelimit:a:b", 30_000);
	});

	it("fails open and logs a warning when the check throws", async () => {
		mocks.eval.mockRejectedValue(new Error("redis down"));

		await expect(checkRateLimit({ key: "a", max: 1, windowSeconds: 1 })).resolves.toEqual({
			allowed: true,
			retryAfterSeconds: 0,
		});
		expect(mocks.warn).toHaveBeenCalledOnce();
	});
});
