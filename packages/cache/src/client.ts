import { Redis, type RedisOptions } from "ioredis";

export const createRedisClient = (url: string, options: RedisOptions = {}) =>
	new Redis(url, { commandTimeout: 2000, connectTimeout: 2000, maxRetriesPerRequest: 1, ...options });
