import type { Redis } from "ioredis";

import { type Duration, toMilliseconds } from "./utils/duration";

const fixedWindowScript = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
	redis.call('PEXPIRE', KEYS[1], ARGV[1])
	ttl = tonumber(ARGV[1])
end
return {count, ttl}`;

export type RateLimitResponse = {
	limit: number;
	remaining: number;
	reset: number;
	success: boolean;
};

export const createRateLimiter = ({
	limit,
	prefix = "ratelimit",
	redis,
	window,
}: {
	limit: number;
	prefix?: string;
	redis: Pick<Redis, "del" | "eval" | "get" | "pttl">;
	window: Duration;
}) => {
	const windowMilliseconds = toMilliseconds(window);
	const keyFor = (identifier: string) => `${prefix}:${identifier}`;
	const resetAt = (ttl: number) => Date.now() + (ttl > 0 ? ttl : windowMilliseconds);

	return {
		getRemaining: async (identifier: string) => {
			const [count, ttl] = await Promise.all([redis.get(keyFor(identifier)), redis.pttl(keyFor(identifier))]);

			return { remaining: Math.max(0, limit - Number(count ?? 0)), reset: resetAt(ttl) };
		},
		limit: async (identifier: string): Promise<RateLimitResponse> => {
			const reply = await redis.eval(fixedWindowScript, 1, keyFor(identifier), windowMilliseconds);
			const [count = 0, ttl = windowMilliseconds] = Array.isArray(reply) ? reply.map(Number) : [];

			return { limit, remaining: Math.max(0, limit - count), reset: resetAt(ttl), success: count <= limit };
		},
		resetUsedTokens: async (identifier: string) => {
			await redis.del(keyFor(identifier));
		},
	};
};
