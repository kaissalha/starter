import { Redis } from "@upstash/redis";
import { afterAll, describe, expect, it } from "vitest";

import { createTCPRedisClient } from "../src/client";
import { consumeRateLimit, createRateLimiter } from "../src/rate-limit";

const redisUrl = process.env.REDIS_URL;

const upstashUrl = process.env.UPSTASH_URL;

const upstashToken = process.env.UPSTASH_TOKEN;

if (!redisUrl || !upstashUrl || !upstashToken) {
	throw new Error("Redis integration environment was not initialized");
}

const redis = new Redis({ enableAutoPipelining: false, token: upstashToken, url: upstashUrl });

const evaluate = redis.eval;

redis.eval = (script, keys, args) => evaluate(script.replace(/^#!lua[^\n]*\n/, ""), keys, args);

redis.evalsha = () => Promise.reject(new Error("NOSCRIPT"));

const tcpRedis = createTCPRedisClient(redisUrl);

afterAll(async () => {
	await tcpRedis.quit();
});

describe("Redis integration", () => {
	it("connects through the production TCP client", async () => {
		await expect(tcpRedis.ping()).resolves.toBe("PONG");
	});

	it("enforces a real fixed-window limit and reset", async () => {
		const identifier = crypto.randomUUID();

		const limiter = createRateLimiter(redis, {
			algorithm: "fixedWindow",
			maxRequests: 1,
			prefix: "integration-rate-limit:",
			withinSeconds: 30,
		});

		await expect(limiter.limit(identifier)).resolves.toMatchObject({ remaining: 0, success: true });
		await expect(limiter.limit(identifier)).resolves.toMatchObject({ remaining: 0, success: false });

		await limiter.reset(identifier);
		await expect(limiter.limit(identifier)).resolves.toMatchObject({ success: true });
	});

	it("counts concurrent hits atomically within one window", async () => {
		const key = crypto.randomUUID();

		const decisions = await Promise.all(
			Array.from({ length: 5 }, () => consumeRateLimit({ key, max: 3, redis: tcpRedis, windowSeconds: 30 }))
		);

		expect(decisions.filter(({ allowed }) => allowed)).toHaveLength(3);
		expect(decisions.find(({ allowed }) => !allowed)?.retryAfterSeconds).toBeLessThanOrEqual(30);
		const ttl = await tcpRedis.ttl(key);
		expect(ttl).toBeGreaterThan(0);
		expect(ttl).toBeLessThanOrEqual(30);
	});

	it("restores a missing window expiry", async () => {
		const key = crypto.randomUUID();
		await tcpRedis.set(key, "10");

		await consumeRateLimit({ key, max: 3, redis: tcpRedis, windowSeconds: 30 });

		await expect(tcpRedis.ttl(key)).resolves.toBeGreaterThan(0);
	});
});
