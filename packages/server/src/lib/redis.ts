import { createRateLimiter, createRedisClient } from "@starter/cache";
import { log, serializeLogError } from "@starter/observability";

type RedisReference = { value?: ReturnType<typeof createRedisClient> };

const redisReference: RedisReference = {};

const streamRedisReference: RedisReference = {};

export const getRedis = () => {
	const url = process.env.REDIS_URL;

	if (!url) {
		return null;
	}

	if (!redisReference.value || redisReference.value.status === "end") {
		redisReference.value = createRedisClient(url, {
			commandTimeout: 300,
			connectTimeout: 300,
			maxRetriesPerRequest: 0,
		}).on("error", () => undefined);
	}

	return redisReference.value;
};

export const getStreamRedis = () => {
	const url = process.env.REDIS_URL;

	if (!url) {
		throw new Error("REDIS_URL is not set");
	}

	streamRedisReference.value ??= createRedisClient(url);

	return streamRedisReference.value;
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
	const redis = getRedis();

	if (!redis) {
		return allowed;
	}

	try {
		const { reset, success } = await createRateLimiter({ limit: max, redis, window: `${windowSeconds} s` }).limit(
			key
		);

		return { allowed: success, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
	} catch (error) {
		await log.warn({ error: serializeLogError(error), message: "Rate limit unavailable; allowing request" });

		return allowed;
	}
};
