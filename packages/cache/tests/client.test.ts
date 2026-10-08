import { describe, expect, it, vi } from "vitest";

const { tcpOptions } = vi.hoisted(() => {
	const tcpOptions: Array<Record<string, number>> = [];

	return { tcpOptions };
});

vi.mock("ioredis", () => {
	return {
		Redis: class MockIORedis {
			constructor(_url: string, options: Record<string, number>) {
				tcpOptions.push(options);
			}
		},
	};
});

import { createTCPRedisClient } from "../src/client";

describe("createTCPRedisClient", () => {
	it("applies bounded timeouts by default", () => {
		tcpOptions.length = 0;

		createTCPRedisClient("redis://localhost:6379");

		expect(tcpOptions).toEqual([{ commandTimeout: 2000, connectTimeout: 2000, maxRetriesPerRequest: 1 }]);
	});

	it("lets caller options override the defaults", () => {
		tcpOptions.length = 0;

		createTCPRedisClient("redis://localhost:6379", { commandTimeout: 300 });

		expect(tcpOptions).toEqual([{ commandTimeout: 300, connectTimeout: 2000, maxRetriesPerRequest: 1 }]);
	});
});
