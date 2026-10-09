import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = vi.hoisted(() => ({ del: vi.fn(), eval: vi.fn(), get: vi.fn(), set: vi.fn() }));

vi.mock("@starter/cache", async (importOriginal) => ({
	...(await importOriginal<typeof import("@starter/cache")>()),
	createRedisClient: vi.fn(() => redis),
}));

import {
	cancelChatStream,
	clearActiveChatStream,
	getActiveChatStream,
	setActiveChatStream,
} from "../../src/services/chat-stream-state";

const chat = { chatId: "chat-1", organizationId: "organization-1" };

describe("chat stream state", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.REDIS_URL = "redis://localhost:6379";
	});

	it("tracks the active stream per organization chat for a day", async () => {
		redis.get.mockResolvedValue("stream-1");

		await setActiveChatStream({ ...chat, streamId: "stream-1" });

		await expect(getActiveChatStream(chat)).resolves.toBe("stream-1");
		expect(redis.set).toHaveBeenCalledWith("chat-stream:organization-1:chat-1", "stream-1", "EX", 86_400);
		expect(redis.get).toHaveBeenCalledWith("chat-stream:organization-1:chat-1");
	});

	it("clears the active stream only while it still belongs to the finishing stream", async () => {
		redis.eval.mockResolvedValue(1);

		await expect(clearActiveChatStream({ ...chat, streamId: "stream-1" })).resolves.toBe(true);

		expect(redis.eval).toHaveBeenCalledWith(
			expect.stringContaining("DEL"),
			1,
			"chat-stream:organization-1:chat-1",
			"stream-1"
		);
	});

	it("cancels by removing the active stream", async () => {
		await cancelChatStream(chat);

		expect(redis.del).toHaveBeenCalledWith("chat-stream:organization-1:chat-1");
	});

	it("has nothing to cancel when Redis is not configured", async () => {
		delete process.env.REDIS_URL;

		await cancelChatStream(chat);

		expect(redis.del).not.toHaveBeenCalled();
	});
});
