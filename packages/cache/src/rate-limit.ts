import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { Redis as IORedis } from "ioredis";

import { log, serializeLogError } from "@starter/observability";

import { getFailFastRedis } from "./client";

export type RateLimitOptions = {
	algorithm?: "fixedWindow" | "slidingWindow" | "tokenBucket";
	maxRequests: number;
	prefix?: string;
	withinSeconds: number;
};

export type RateLimitResult = {
	maxRequests: number;
	remaining: number;
	success: boolean;
	willResetOn: number;
};

const createRateLimitAlgorithm = ({
	algorithm,
	maxRequests,
	withinSeconds,
}: {
	algorithm: RateLimitOptions["algorithm"];
	maxRequests: number;
	withinSeconds: number;
}) => {
	if (algorithm === "slidingWindow") {
		return Ratelimit.slidingWindow(maxRequests, `${withinSeconds} s`);
	}

	if (algorithm === "fixedWindow") {
		return Ratelimit.fixedWindow(maxRequests, `${withinSeconds} s`);
	}

	return Ratelimit.tokenBucket(maxRequests, `${withinSeconds} s`, maxRequests);
};

export const createRateLimiter = (redis: Redis, options: RateLimitOptions) => {
	const { algorithm = "tokenBucket", maxRequests, prefix = "ratelimit:", withinSeconds } = options;

	const limiter = new Ratelimit({
		analytics: true,
		limiter: createRateLimitAlgorithm({ algorithm, maxRequests, withinSeconds }),
		prefix,
		redis,
	});

	const limit = async (identifier: string): Promise<RateLimitResult> => {
		const result = await limiter.limit(identifier);

		return {
			maxRequests,
			remaining: result.remaining,
			success: result.success,
			willResetOn: result.reset,
		};
	};

	const reset = async (identifier: string): Promise<void> => {
		await limiter.resetUsedTokens(identifier);
	};

	return {
		limit,
		reset,
	};
};

export const consumeRateLimit = async ({
	key,
	max,
	redis,
	windowSeconds,
}: {
	key: string;
	max: number;
	redis: Pick<IORedis, "eval">;
	windowSeconds: number;
}) => {
	const reply = await redis.eval(
		"local count = redis.call('INCR', KEYS[1]) local ttl = redis.call('TTL', KEYS[1]) if ttl < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) ttl = tonumber(ARGV[1]) end return {count, ttl}",
		1,
		key,
		windowSeconds
	);

	const [count = 0, ttl = windowSeconds] = Array.isArray(reply) ? reply.map(Number) : [];

	return { allowed: count <= max, retryAfterSeconds: Math.max(1, ttl) };
};

const allowed = { allowed: true, retryAfterSeconds: 0 };

export const checkRateLimit = async ({
	key,
	max,
	windowSeconds,
}: {
	key: string;
	max: number;
	windowSeconds: number;
}) => {
	try {
		const redis = getFailFastRedis();

		return redis ? await consumeRateLimit({ key: `ratelimit:${key}`, max, redis, windowSeconds }) : allowed;
	} catch (error) {
		await log.warn({ error: serializeLogError(error), message: "Rate limit unavailable; allowing request" });

		return allowed;
	}
};
