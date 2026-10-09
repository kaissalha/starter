import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createCache } from "../src/cache";
import { createRedisClient } from "../src/client";
import { createLock } from "../src/lock";
import { createRateLimiter } from "../src/rate-limit";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
	throw new Error("Redis integration environment was not initialized");
}

const redis = createRedisClient(redisUrl);

const limiter = createRateLimiter({ limit: 3, prefix: "integration", redis, window: "30 s" });

afterAll(async () => {
	await redis.quit();
});

describe("Redis integration", () => {
	it("connects through the production client", async () => {
		await expect(redis.ping()).resolves.toBe("PONG");
	});

	it("counts concurrent hits atomically within one window", async () => {
		const identifier = crypto.randomUUID();

		const responses = await Promise.all(Array.from({ length: 5 }, () => limiter.limit(identifier)));

		expect(responses.filter(({ success }) => success)).toHaveLength(3);
		expect(responses.find(({ success }) => !success)?.reset).toBeLessThanOrEqual(Date.now() + 30_000);
		const ttl = await redis.pttl(`integration:${identifier}`);
		expect(ttl).toBeGreaterThan(0);
		expect(ttl).toBeLessThanOrEqual(30_000);
		await expect(limiter.getRemaining(identifier)).resolves.toMatchObject({ remaining: 0 });

		await limiter.resetUsedTokens(identifier);
		await expect(limiter.limit(identifier)).resolves.toMatchObject({ remaining: 2, success: true });
	});

	it("restores a missing window expiry", async () => {
		const identifier = crypto.randomUUID();
		await redis.set(`integration:${identifier}`, "10");

		await limiter.limit(identifier);

		await expect(redis.pttl(`integration:${identifier}`)).resolves.toBeGreaterThan(0);
	});

	it("caches validated JSON with an expiry", async () => {
		const cache = createCache({
			ex: 30,
			prefix: "integration-cache",
			redis,
			schema: z.object({ count: z.number() }),
		});

		const key = crypto.randomUUID();

		await expect(cache.getOrSet(key, async () => ({ count: 1 }))).resolves.toEqual({ count: 1 });
		await expect(cache.get(key)).resolves.toEqual({ count: 1 });
		await expect(redis.ttl(`integration-cache:${key}`)).resolves.toBeGreaterThan(0);

		await cache.del(key);
		await expect(cache.get(key)).resolves.toBeUndefined();
	});

	it("locks with owner-checked extend and release", async () => {
		const id = `integration-lock:${crypto.randomUUID()}`;
		const owner = createLock({ id, lease: "30 s", redis });
		const contender = createLock({ id, lease: "30 s", redis });

		await expect(owner.acquire()).resolves.toBe(true);
		await expect(contender.acquire()).resolves.toBe(false);
		await expect(contender.extend()).resolves.toBe(false);
		await expect(contender.release()).resolves.toBe(false);
		await expect(redis.get(id)).resolves.toBe(owner.token);

		await expect(owner.extend("2 m")).resolves.toBe(true);
		await expect(redis.pttl(id)).resolves.toBeGreaterThan(30_000);

		await expect(owner.release()).resolves.toBe(true);
		await expect(contender.acquire()).resolves.toBe(true);
		await contender.release();
	});
});
