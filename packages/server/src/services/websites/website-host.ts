import { waitUntil } from "@vercel/functions";
import { and, eq } from "drizzle-orm";
import { validate as isUuid } from "uuid";
import { z } from "zod";

import { getFailFastRedis } from "@starter/cache";
import { db, websites, websiteDomains } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";

import { domainHostnameSchema } from "./domain-input";

const hostTtlSeconds = 300;

const hostEntrySchema = z.compile(z.strictObject({ websiteId: z.uuid().nullable() }));

const primaryEntrySchema = z.compile(z.strictObject({ hostname: z.string().nullable() }));

const hostKey = (hostname: string) => `website-host:v1:${hostname}`;

const primaryKey = (websiteId: string) => `website-primary:v1:${websiteId}`;

const cacheWarning = { lastAt: 0 };

const warnCacheFailure = async ({
	cause,
	operation,
}: {
	cause: unknown;
	operation: "invalidate" | "read" | "write";
}) => {
	if (Date.now() - cacheWarning.lastAt < 60_000) {
		return;
	}

	cacheWarning.lastAt = Date.now();
	await log.warn({ error: serializeLogError(cause), message: "Website host cache unavailable", operation });
};

const redisBreaker = { until: 0 };

const readCached = async <T>(key: string, schema: z.ZodType<T>) => {
	if (Date.now() < redisBreaker.until) {
		return null;
	}

	const value = await (async () => {
		try {
			return await getFailFastRedis()?.get(key);
		} catch (error) {
			redisBreaker.until = Date.now() + 30_000;
			await warnCacheFailure({ cause: error, operation: "read" });

			return null;
		}
	})();

	try {
		return value ? (schema.safeParse(JSON.parse(value)).data ?? null) : null;
	} catch {
		return null;
	}
};

const writeCached = async (key: string, value: { hostname: string | null } | { websiteId: string | null }) => {
	if (Date.now() < redisBreaker.until) {
		return;
	}

	try {
		await getFailFastRedis()?.set(key, JSON.stringify(value), "EX", hostTtlSeconds);
	} catch (error) {
		redisBreaker.until = Date.now() + 30_000;
		await warnCacheFailure({ cause: error, operation: "write" });
	}
};

export const invalidateWebsiteHosts = async ({
	hostnames,
	websiteId,
}: {
	hostnames: Array<string>;
	websiteId: string;
}) => {
	const keys = [primaryKey(websiteId), ...hostnames.map(hostKey)];

	try {
		await getFailFastRedis()?.del(...keys);
	} catch {
		try {
			await getFailFastRedis()?.del(...keys);
		} catch (error) {
			await warnCacheFailure({ cause: error, operation: "invalidate" });
		}
	}
};

const getWebsitePlatformDomain = () => process.env.WEBSITES_PLATFORM_DOMAIN?.trim().toLowerCase() || null;

export const getWebsiteAddress = (subdomain: string | null) => {
	const platform = getWebsitePlatformDomain();

	return platform && subdomain ? `${subdomain}.${platform}` : null;
};

export const isPlatformHostname = (hostname: string) => {
	const platform = getWebsitePlatformDomain();

	return Boolean(
		platform && (hostname === platform || hostname.endsWith(`.${platform}`) || platform.endsWith(`.${hostname}`))
	);
};

const findWebsiteIdByHost = async (hostname: string) => {
	const platform = getWebsitePlatformDomain();
	const subdomain = platform && hostname.endsWith(`.${platform}`) ? hostname.slice(0, -platform.length - 1) : null;

	if (subdomain !== null) {
		if (subdomain.includes(".")) {
			return null;
		}

		const [website] = await db
			.select({ websiteId: websites.id })
			.from(websites)
			.where(eq(websites.subdomain, subdomain))
			.limit(1);

		return website?.websiteId ?? null;
	}

	const [domain] = await db
		.select({ websiteId: websiteDomains.websiteId })
		.from(websiteDomains)
		.where(
			and(
				eq(websiteDomains.hostname, hostname),
				eq(websiteDomains.status, "connected"),
				eq(websiteDomains.ownershipVerified, true)
			)
		)
		.limit(1);

	return domain?.websiteId ?? null;
};

const resolveWebsiteId = async (hostname: string) => {
	const cached = await readCached(hostKey(hostname), hostEntrySchema);

	if (cached) {
		return cached.websiteId;
	}

	const websiteId = await findWebsiteIdByHost(hostname);
	waitUntil(writeCached(hostKey(hostname), { websiteId }));

	return websiteId;
};

const resolvePrimaryHostname = async (websiteId: string) => {
	const cached = await readCached(primaryKey(websiteId), primaryEntrySchema);

	if (cached) {
		return cached.hostname;
	}

	const [primary] = await db
		.select({ hostname: websiteDomains.hostname })
		.from(websiteDomains)
		.where(
			and(
				eq(websiteDomains.websiteId, websiteId),
				eq(websiteDomains.primary, true),
				eq(websiteDomains.status, "connected")
			)
		)
		.limit(1);

	const hostname = primary?.hostname ?? null;
	waitUntil(writeCached(primaryKey(websiteId), { hostname }));

	return hostname;
};

export const resolveWebsiteHost = async (host: string | null) => {
	const localId =
		process.env.NODE_ENV === "development"
			? host?.toLowerCase().match(/^([a-f0-9-]+)\.localhost(?::\d+)?$/u)?.[1]
			: undefined;

	if (localId && isUuid(localId)) {
		const [website] = await db
			.select({ websiteId: websites.id })
			.from(websites)
			.where(eq(websites.id, localId))
			.limit(1);

		return website ? { preview: true, primaryHostname: null, websiteId: website.websiteId } : null;
	}

	const parsed = domainHostnameSchema.safeParse(host);

	if (!parsed.success) {
		return null;
	}

	const websiteId = await resolveWebsiteId(parsed.data);

	if (!websiteId) {
		return null;
	}

	return { preview: false, primaryHostname: await resolvePrimaryHostname(websiteId), websiteId };
};
