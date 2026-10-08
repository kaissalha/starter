import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const store = new Map<string, string>();

	const redis = {
		del: vi.fn(async (...keys: Array<string>) => keys.filter((key) => store.delete(key)).length),
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		on: vi.fn(() => redis),
		set: vi.fn(async (key: string, value: string) => {
			store.set(key, value);

			return "OK";
		}),
		status: "ready",
	};

	return {
		pending: new Array<Promise<unknown>>(),
		query: vi.fn<(field: string) => Array<Record<string, string>>>(),
		redis,
		store,
		warn: vi.fn(),
	};
});

vi.mock("@starter/cache", () => ({ getFailFastRedis: () => mocks.redis }));

vi.mock("@starter/db", () => ({
	db: {
		select: (fields: Record<string, string>) => ({
			from: () => ({ where: () => ({ limit: async () => mocks.query(Object.keys(fields)[0] ?? "") }) }),
		}),
	},
	websiteDomains: {},
	websites: {},
}));

vi.mock("@vercel/functions", () => ({
	waitUntil: (promise: Promise<unknown>) => {
		mocks.pending.push(promise);
	},
}));

vi.mock("@starter/observability", () => ({ log: { warn: mocks.warn }, serializeLogError: (error: Error) => error }));

const websiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d339";

const load = () => import("../../src/services/websites/website-host");

const settle = async () => {
	await Promise.all(mocks.pending.splice(0));
};

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-28T00:00:00Z"));
	vi.stubEnv("REDIS_URL", "redis://host.test");
	mocks.store.clear();
	mocks.pending.length = 0;
	mocks.query.mockImplementation((field) =>
		field === "websiteId" ? [{ websiteId }] : [{ hostname: "example.com" }]
	);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

describe("website host cache", () => {
	it("serves cache hits without database reads", async () => {
		const { resolveWebsiteHost } = await load();
		mocks.store.set("website-host:v1:example.com", JSON.stringify({ websiteId }));
		mocks.store.set(`website-primary:v1:${websiteId}`, JSON.stringify({ hostname: "example.com" }));
		expect(await resolveWebsiteHost("example.com")).toEqual({
			preview: false,
			primaryHostname: "example.com",
			websiteId,
		});
		expect(mocks.query).not.toHaveBeenCalled();
	});

	it("writes both entries after a cache miss without blocking the request", async () => {
		const { resolveWebsiteHost } = await load();
		expect(await resolveWebsiteHost("example.com")).toMatchObject({ websiteId });
		await settle();
		expect(mocks.redis.set).toHaveBeenCalledWith(
			"website-host:v1:example.com",
			JSON.stringify({ websiteId }),
			"EX",
			300
		);
		expect(mocks.redis.set).toHaveBeenCalledWith(
			`website-primary:v1:${websiteId}`,
			JSON.stringify({ hostname: "example.com" }),
			"EX",
			300
		);
	});

	it("honors cached negative entries", async () => {
		const { resolveWebsiteHost } = await load();
		mocks.store.set("website-host:v1:example.com", JSON.stringify({ websiteId: null }));
		expect(await resolveWebsiteHost("example.com")).toBeNull();
		expect(mocks.query).not.toHaveBeenCalled();
	});

	it("falls back to the database on corrupt entries without opening the breaker", async () => {
		const { resolveWebsiteHost } = await load();
		mocks.store.set("website-host:v1:example.com", "{");
		expect(await resolveWebsiteHost("example.com")).toMatchObject({ websiteId });
		await settle();
		mocks.redis.get.mockClear();
		await resolveWebsiteHost("example.com");
		expect(mocks.redis.get).toHaveBeenCalled();
	});

	it("skips redis for 30 seconds after a failure", async () => {
		const { resolveWebsiteHost } = await load();
		mocks.redis.get.mockRejectedValueOnce(new Error("redis down"));
		expect(await resolveWebsiteHost("example.com")).toMatchObject({ websiteId });
		await settle();
		mocks.redis.get.mockClear();
		expect(await resolveWebsiteHost("example.com")).toMatchObject({ websiteId });
		expect(mocks.redis.get).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(30_000);
		await resolveWebsiteHost("example.com");
		expect(mocks.redis.get).toHaveBeenCalled();
	});

	it("rereads the database after invalidation", async () => {
		const { invalidateWebsiteHosts, resolveWebsiteHost } = await load();
		await resolveWebsiteHost("example.com");
		await settle();
		mocks.query.mockReturnValue([]);
		await invalidateWebsiteHosts({ hostnames: ["example.com"], websiteId });
		expect(await resolveWebsiteHost("example.com")).toBeNull();
	});

	it("retries invalidation once and warns only when both attempts fail", async () => {
		const { invalidateWebsiteHosts } = await load();
		mocks.redis.del.mockRejectedValueOnce(new Error("redis down"));
		await invalidateWebsiteHosts({ hostnames: ["example.com"], websiteId });
		expect(mocks.redis.del).toHaveBeenCalledTimes(2);
		expect(mocks.warn).not.toHaveBeenCalled();
		mocks.redis.del.mockRejectedValueOnce(new Error("redis down")).mockRejectedValueOnce(new Error("redis down"));
		await expect(invalidateWebsiteHosts({ hostnames: ["example.com"], websiteId })).resolves.toBeUndefined();
		expect(mocks.warn).toHaveBeenCalledOnce();
		expect(mocks.warn).toHaveBeenCalledWith(expect.objectContaining({ operation: "invalidate" }));
	});

	it("attempts invalidation while the breaker is open", async () => {
		const { invalidateWebsiteHosts, resolveWebsiteHost } = await load();
		mocks.redis.get.mockRejectedValueOnce(new Error("redis down"));
		await resolveWebsiteHost("example.com");
		await invalidateWebsiteHosts({ hostnames: ["example.com"], websiteId });
		expect(mocks.redis.del).toHaveBeenCalledWith(`website-primary:v1:${websiteId}`, "website-host:v1:example.com");
	});

	it("rate-limits read failure warnings", async () => {
		const { resolveWebsiteHost } = await load();
		mocks.redis.get.mockRejectedValue(new Error("redis down"));
		await resolveWebsiteHost("first.example.com");
		await vi.advanceTimersByTimeAsync(31_000);
		await resolveWebsiteHost("second.example.com");
		expect(mocks.warn.mock.calls.filter(([entry]) => entry.operation === "read")).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(61_000);
		await resolveWebsiteHost("third.example.com");
		expect(mocks.warn.mock.calls.filter(([entry]) => entry.operation === "read")).toHaveLength(2);
	});
});
