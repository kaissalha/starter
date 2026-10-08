# Key-Value Storage Package

A Redis-based key-value storage package with rate limiting functionality.

Usage example:

```typescript
import { createRateLimiter, createRedisClient } from "@starter/cache";

export const redis = createRedisClient({
	url: process.env.UPSTASH_URL!,
	token: process.env.UPSTASH_TOKEN!,
});

export const featureRateLimiter = createRateLimiter(redis, {
	prefix: "webapp:rate-limit:chats",
	maxRequests: 5000, // Maximum requests per window
	withinSeconds: 24 * 60 * 60, // 24 hours window
});
```

## Shared window limits over TCP Redis

`consumeRateLimit` runs an atomic fixed-window counter on an ioredis client and throws on Redis errors.
`checkRateLimit` wraps it on the shared `getFailFastRedis()` client (`REDIS_URL`, 300 ms timeouts, no retries)
and fails open, logging a warning through `@starter/observability`.

```typescript
import { consumeRateLimit, createTCPRedisClient } from "@starter/cache";

const redis = createTCPRedisClient(process.env.REDIS_URL!);
const { allowed, retryAfterSeconds } = await consumeRateLimit({
	key: "ratelimit:contact:site-1",
	max: 30,
	redis,
	windowSeconds: 300,
});
```
