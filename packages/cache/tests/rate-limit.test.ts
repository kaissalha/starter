import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "../src/rate-limit";

const redis = { del: vi.fn(), eval: vi.fn(), get: vi.fn(), pttl: vi.fn() };

const limiter = createRateLimiter({ limit: 3, redis, window: "1 m" });

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers({ now: 1_000_000 });
});

afterEach(() => {
	vi.useRealTimers();
});

describe("createRateLimiter", () => {
	it("allows hits within the window", async () => {
		redis.eval.mockResolvedValue([3, 55_000]);

		await expect(limiter.limit("user-1")).resolves.toEqual({
			limit: 3,
			remaining: 0,
			reset: 1_055_000,
			success: true,
		});
		expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("INCR"), 1, "ratelimit:user-1", 60_000);
	});

	it("denies hits over the limit", async () => {
		redis.eval.mockResolvedValue([4, 12_000]);

		await expect(limiter.limit("user-1")).resolves.toMatchObject({ remaining: 0, success: false });
	});

	it("applies a custom prefix and accepts compact durations", async () => {
		redis.eval.mockResolvedValue([1, 500]);

		await createRateLimiter({ limit: 1, prefix: "api", redis, window: "500ms" }).limit("org-1");

		expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, "api:org-1", 500);
	});

	it("rejects invalid windows", () => {
		expect(() => createRateLimiter({ limit: 1, redis, window: "0 s" })).toThrow("Invalid duration");
	});

	it("allows a malformed reply", async () => {
		redis.eval.mockResolvedValue("OK");

		await expect(limiter.limit("user-1")).resolves.toMatchObject({ success: true });
	});

	it("propagates Redis errors", async () => {
		const error = new Error("redis down");
		redis.eval.mockRejectedValue(error);

		await expect(limiter.limit("user-1")).rejects.toBe(error);
	});

	it("reports remaining tokens without consuming one", async () => {
		redis.get.mockResolvedValue("2");
		redis.pttl.mockResolvedValue(10_000);

		await expect(limiter.getRemaining("user-1")).resolves.toEqual({ remaining: 1, reset: 1_010_000 });
		expect(redis.eval).not.toHaveBeenCalled();
	});

	it("resets used tokens", async () => {
		await limiter.resetUsedTokens("user-1");

		expect(redis.del).toHaveBeenCalledWith("ratelimit:user-1");
	});
});
