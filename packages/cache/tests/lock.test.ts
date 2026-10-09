import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLock } from "../src/lock";

const redis = { eval: vi.fn(), set: vi.fn() };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createLock", () => {
	it("acquires with a generated owner token and lease", async () => {
		redis.set.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);
		const lock = createLock({ id: "job:1", lease: "30 s", redis });

		await expect(lock.acquire()).resolves.toBe(true);
		await expect(lock.acquire()).resolves.toBe(false);

		expect(lock.token).toMatch(/^[\da-f-]{36}$/u);
		expect(redis.set).toHaveBeenCalledWith("job:1", lock.token, "PX", 30_000, "NX");
	});

	it("extends and releases only as the owner", async () => {
		redis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
		const lock = createLock({ id: "job:1", lease: "30 s", redis, token: "owner" });

		await expect(lock.extend()).resolves.toBe(true);
		await expect(lock.extend("5 m")).resolves.toBe(false);
		await expect(lock.release()).resolves.toBe(true);

		expect(redis.eval).toHaveBeenNthCalledWith(1, expect.stringContaining("PEXPIRE"), 1, "job:1", "owner", 30_000);
		expect(redis.eval).toHaveBeenNthCalledWith(2, expect.stringContaining("PEXPIRE"), 1, "job:1", "owner", 300_000);
		expect(redis.eval).toHaveBeenNthCalledWith(3, expect.stringContaining("DEL"), 1, "job:1", "owner");
	});
});
