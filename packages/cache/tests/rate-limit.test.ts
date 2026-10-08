import { Redis } from "@upstash/redis";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fixedWindowMock, slidingWindowMock, tokenBucketMock } = vi.hoisted(() => ({
	fixedWindowMock: vi.fn(),
	slidingWindowMock: vi.fn(),
	tokenBucketMock: vi.fn(),
}));

const limiterInstance = {
	limit: vi.fn(),
};

vi.mock("@upstash/ratelimit", () => {
	return {
		Ratelimit: Object.assign(
			class {
				limit = limiterInstance.limit;
			},
			{
				fixedWindow: fixedWindowMock,
				slidingWindow: slidingWindowMock,
				tokenBucket: tokenBucketMock,
			}
		),
	};
});

import { consumeRateLimit, createRateLimiter } from "../src/rate-limit";

const redis = new Redis({ token: "test-token", url: "https://rate-limit-test.upstash.io" });

describe("createRateLimiter", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses token bucket by default", async () => {
		limiterInstance.limit.mockResolvedValue({ remaining: 2, reset: 100, success: true });
		tokenBucketMock.mockReturnValue({});

		const limiter = createRateLimiter(redis, { maxRequests: 3, withinSeconds: 60 });
		const result = await limiter.limit("user-1");

		expect(tokenBucketMock).toHaveBeenCalledWith(3, "60 s", 3);
		expect(result).toEqual({ maxRequests: 3, remaining: 2, success: true, willResetOn: 100 });
	});

	it("uses sliding window when configured", async () => {
		slidingWindowMock.mockReturnValue({});

		createRateLimiter(redis, { algorithm: "slidingWindow", maxRequests: 5, withinSeconds: 10 });

		expect(slidingWindowMock).toHaveBeenCalledWith(5, "10 s");
	});

	it("uses fixed window when configured", async () => {
		fixedWindowMock.mockReturnValue({});

		createRateLimiter(redis, { algorithm: "fixedWindow", maxRequests: 10, withinSeconds: 30 });

		expect(fixedWindowMock).toHaveBeenCalledWith(10, "30 s");
	});
});

describe("consumeRateLimit", () => {
	const redis = { eval: vi.fn() };
	const consume = (max = 3) => consumeRateLimit({ key: "k", max, redis, windowSeconds: 60 });

	it("allows hits within the window", async () => {
		redis.eval.mockResolvedValue([3, 55]);

		await expect(consume()).resolves.toEqual({ allowed: true, retryAfterSeconds: 55 });
		expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("INCR"), 1, "k", 60);
	});

	it("denies hits over the limit", async () => {
		redis.eval.mockResolvedValue([4, 12]);

		await expect(consume()).resolves.toEqual({ allowed: false, retryAfterSeconds: 12 });
	});

	it("floors the retry delay at one second", async () => {
		redis.eval.mockResolvedValue([9, 0]);

		await expect(consume()).resolves.toMatchObject({ retryAfterSeconds: 1 });
	});

	it("allows a malformed reply", async () => {
		redis.eval.mockResolvedValue("OK");

		await expect(consume()).resolves.toMatchObject({ allowed: true });
	});

	it("propagates Redis errors", async () => {
		const error = new Error("redis down");
		redis.eval.mockRejectedValue(error);

		await expect(consume()).rejects.toBe(error);
	});
});
