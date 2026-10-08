import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ eval: vi.fn(), redis: vi.fn(), warn: vi.fn() }));

vi.mock("../src/client", () => ({ getFailFastRedis: mocks.redis }));

vi.mock("@starter/observability", () => ({ log: { warn: mocks.warn }, serializeLogError: (error: Error) => error }));

import { checkRateLimit } from "../src/rate-limit";

beforeEach(() => {
	vi.clearAllMocks();
	mocks.redis.mockReturnValue({ eval: mocks.eval });
	mocks.eval.mockResolvedValue([1, 30]);
});

describe("checkRateLimit", () => {
	it("allows without touching Redis when it is not configured", async () => {
		mocks.redis.mockReturnValue(null);

		await expect(checkRateLimit({ key: "a", max: 1, windowSeconds: 1 })).resolves.toEqual({
			allowed: true,
			retryAfterSeconds: 0,
		});
		expect(mocks.eval).not.toHaveBeenCalled();
	});

	it("namespaces the key and returns the shared decision", async () => {
		mocks.eval.mockResolvedValue([3, 7]);

		await expect(checkRateLimit({ key: "a:b", max: 2, windowSeconds: 30 })).resolves.toEqual({
			allowed: false,
			retryAfterSeconds: 7,
		});
		expect(mocks.eval).toHaveBeenCalledWith(expect.any(String), 1, "ratelimit:a:b", 30);
	});

	it("fails open and logs a warning when the check throws", async () => {
		mocks.eval.mockRejectedValue(new Error("redis down"));

		await expect(checkRateLimit({ key: "a", max: 1, windowSeconds: 1 })).resolves.toEqual({
			allowed: true,
			retryAfterSeconds: 0,
		});
		expect(mocks.warn).toHaveBeenCalledOnce();
	});
});
