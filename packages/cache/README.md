# Cache Package

Caching, rate limiting, and locks on plain Redis through ioredis, with an API modeled on `@upstash/redis`,
`@upstash/ratelimit`, and `@upstash/lock`. Works with any Redis-compatible server, including Upstash over `rediss://`.
The package reads no environment variables and holds no shared clients: create a client once and pass it to the
helpers.

## Client

```typescript
import { createRedisClient } from "@starter/cache";

const redis = createRedisClient(process.env.REDIS_URL!);
```

Defaults are 2 s connect/command timeouts and one retry; pass ioredis options to override them. In `@starter/server`,
use `getRedis()` from `src/lib/redis.ts`: the shared fail-fast client (300 ms timeouts, no retries), or `null` when
`REDIS_URL` is unset.

## Caching

```typescript
import { z } from "zod";

import { createCache } from "@starter/cache";

const summaries = createCache({
	ex: 3600, // default expiry in seconds; omit to keep entries until deleted
	prefix: "summary:v1",
	redis,
	schema: z.object({ text: z.string() }),
});

await summaries.set(documentId, { text: "..." });
await summaries.set(documentId, { text: "..." }, { ex: 60 }); // per-write expiry
const summary = await summaries.get(documentId); // { text: string } | undefined
await summaries.del(documentId);

const fresh = await summaries.getOrSet(documentId, () => summarize(documentId));
```

- Values are stored as JSON under `prefix:key` and validated with the schema on every read; cached data is untrusted.
- Caches fail open: a Redis error, a missing key, malformed JSON, or a value that no longer matches the schema reads as a
  miss, and failed writes and deletes are ignored. `getOrSet` therefore still returns the loaded value when Redis is down.
- Bump the prefix version (`v1` → `v2`) when the cached shape changes instead of migrating old entries.

`packages/server/src/ai/decisions.ts` memoizes classifier answers with `createCache`.

## Rate limiting

```typescript
import { createRateLimiter } from "@starter/cache";

const ratelimit = createRateLimiter({
	limit: 30,
	prefix: "ratelimit", // default
	redis,
	window: "60 s", // ms, s, m, h, or d; "60s" also works
});

const { limit, remaining, reset, success } = await ratelimit.limit(organizationId);

if (!success) {
	const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);
}

await ratelimit.getRemaining(organizationId); // { remaining, reset } without consuming a request
await ratelimit.resetUsedTokens(organizationId);
```

`limit` is a fixed window counted by one Lua script: concurrent requests are counted exactly, and a key that lost its
expiry gets it back. `reset` is a Unix timestamp in milliseconds, as in Upstash. Rate limiter calls throw on Redis
errors so callers choose whether to fail open. In `@starter/server`, `checkRateLimit` from `src/lib/redis.ts` allows
requests when `REDIS_URL` is unset and fails open with a logged warning.

## Locks

```typescript
import { createLock } from "@starter/cache";

const lock = createLock({ id: `report:${organizationId}`, lease: "30 s", redis });

if (await lock.acquire()) {
	try {
		await lock.extend("2 m"); // defaults to the original lease
	} finally {
		await lock.release();
	}
}
```

`acquire` sets the key only when it is free and returns whether this lock now owns it. `extend` and `release` act only
while the key still holds this lock's `token`, so an expired owner can never extend or release someone else's lock.
The token is a random UUID by default; pass `token` to act on a lock acquired elsewhere, for example a lease handed
between requests. Lock calls throw on Redis errors. `packages/server/src/services/chat-stream-state.ts` uses locks for
the organization AI shutdown lease and chat message/continuation claims.

Durations (`lease`, `window`) accept `ms`, `s`, `m`, `h`, or `d`, with or without a space: `"500ms"`, `"30 s"`,
`"7 d"`.

## Tests

`bun run test packages/cache` runs the unit tests and the integration suite, which starts a Redis container through
Testcontainers (Docker required).
