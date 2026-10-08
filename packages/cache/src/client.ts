import { Redis } from "@upstash/redis";
import { Redis as IORedis, type RedisOptions } from "ioredis";

export type RedisConfig = {
	token: string;
	url: string;
};

export const createRedisClient = (config: RedisConfig): Redis => {
	return new Redis({
		token: config.token,
		url: config.url,
	});
};

export const createTCPRedisClient = (url: string, options: RedisOptions = {}): IORedis => {
	return new IORedis(url, { commandTimeout: 2000, connectTimeout: 2000, maxRetriesPerRequest: 1, ...options });
};

type FailFastClient = { value?: IORedis };

const failFastClient: FailFastClient = {};

export const getFailFastRedis = () => {
	const url = process.env.REDIS_URL;

	if (!url) {
		return null;
	}

	if (failFastClient.value?.status === "end") {
		failFastClient.value = undefined;
	}

	failFastClient.value ??= createTCPRedisClient(url, {
		commandTimeout: 300,
		connectTimeout: 300,
		maxRetriesPerRequest: 0,
	}).on("error", () => undefined);

	return failFastClient.value;
};
