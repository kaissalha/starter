import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createCache } from "../src/cache";

const store = new Map<string, string>();

const redis = { del: vi.fn(), get: vi.fn(), set: vi.fn() };

const cache = createCache({ ex: 60, prefix: "summary:v1", redis, schema: z.object({ text: z.string() }) });

beforeEach(() => {
	vi.clearAllMocks();
	store.clear();
	redis.del.mockImplementation(async (key: string) => Number(store.delete(key)));
	redis.get.mockImplementation(async (key: string) => store.get(key) ?? null);
	redis.set.mockImplementation(async (key: string, value: string) => {
		store.set(key, value);

		return "OK";
	});
});

describe("createCache", () => {
	it("round-trips JSON values under the prefix with the default expiry", async () => {
		await cache.set("doc-1", { text: "hello" });

		expect(redis.set).toHaveBeenCalledWith("summary:v1:doc-1", '{"text":"hello"}', "EX", 60);
		await expect(cache.get("doc-1")).resolves.toEqual({ text: "hello" });
	});

	it("lets a write override the expiry", async () => {
		await cache.set("doc-1", { text: "hello" }, { ex: 5 });

		expect(redis.set).toHaveBeenCalledWith("summary:v1:doc-1", '{"text":"hello"}', "EX", 5);
	});

	it("writes without expiry when none is configured", async () => {
		const persistent = createCache({ prefix: "flags", redis, schema: z.boolean() });

		await persistent.set("beta", true);

		expect(redis.set).toHaveBeenCalledWith("flags:beta", "true");
		await expect(persistent.get("beta")).resolves.toBe(true);
	});

	it("treats missing, malformed, and mismatched values as misses", async () => {
		store.set("summary:v1:invalid-json", "{");
		store.set("summary:v1:wrong-shape", '{"text":1}');

		await expect(cache.get("missing")).resolves.toBeUndefined();
		await expect(cache.get("invalid-json")).resolves.toBeUndefined();
		await expect(cache.get("wrong-shape")).resolves.toBeUndefined();
	});

	it("deletes values", async () => {
		await cache.set("doc-1", { text: "hello" });
		await cache.del("doc-1");

		await expect(cache.get("doc-1")).resolves.toBeUndefined();
	});

	it("loads and stores a value once with getOrSet", async () => {
		const load = vi.fn(async () => ({ text: "fresh" }));

		await expect(cache.getOrSet("doc-1", load)).resolves.toEqual({ text: "fresh" });
		await expect(cache.getOrSet("doc-1", load)).resolves.toEqual({ text: "fresh" });

		expect(load).toHaveBeenCalledOnce();
	});

	it("fails open when Redis is unavailable", async () => {
		const error = new Error("redis down");
		redis.get.mockRejectedValueOnce(error);
		redis.set.mockRejectedValueOnce(error);
		redis.del.mockRejectedValueOnce(error);

		await expect(cache.getOrSet("doc-1", async () => ({ text: "fresh" }))).resolves.toEqual({ text: "fresh" });
		await expect(cache.del("doc-1")).resolves.toBeUndefined();
	});
});
