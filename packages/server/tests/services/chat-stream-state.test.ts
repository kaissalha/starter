import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = vi.hoisted(() => ({
	del: vi.fn(),
	eval: vi.fn(),
	get: vi.fn(),
	scard: vi.fn(),
	set: vi.fn(),
}));

vi.mock("@starter/cache", () => ({ createTCPRedisClient: vi.fn(() => redis) }));

import {
	consumeChatRequestBudget,
	ChatCapacityError,
	beginOrganizationAIShutdown,
	cancelStream,
	claimChatMessage,
	claimChatContinuation,
	clearActiveChatStreamId,
	clearOrganizationAIShutdown,
	clearResumableChatStreamId,
	getActiveChatStreamId,
	getOrganizationActiveStreamCount,
	getResumableChatStreamId,
	releaseChatMessage,
	renewOrganizationAIShutdown,
	setChatStreamId,
} from "../../src/services/chat-stream-state";

const chatId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const organizationId = "organization-1";

describe("chat stream state", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.REDIS_URL = "redis://localhost:6379";
	});

	it("checks request and organization budgets before expensive work", async () => {
		redis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
		await expect(consumeChatRequestBudget({ organizationId, userId: "user-1" })).resolves.toBe(true);
		await expect(consumeChatRequestBudget({ organizationId, userId: "user-1" })).resolves.toBe(false);
		expect(redis.eval).toHaveBeenCalledWith(
			expect.stringContaining("prune(KEYS[3], ARGV[1])"),
			3,
			`chat-request-user:${organizationId}:user-1`,
			`chat-request-organization:${organizationId}`,
			`chat-stream-executions:${organizationId}`,
			`chat-stream-active:${organizationId}:`
		);
	});
	it("rejects concurrent capacity without treating it as organization deletion", async () => {
		redis.eval.mockResolvedValueOnce(-1);
		await expect(setChatStreamId({ chatId, organizationId, streamId: "over-capacity" })).rejects.toBeInstanceOf(
			ChatCapacityError
		);
	});

	it("atomically registers active execution and stream pointers while the organization is open", async () => {
		redis.eval.mockResolvedValueOnce(1);
		redis.get.mockResolvedValueOnce("stream-1").mockResolvedValueOnce("stream-1");

		await expect(setChatStreamId({ chatId, organizationId, streamId: "stream-1" })).resolves.toBe(true);
		await expect(getActiveChatStreamId({ chatId, organizationId })).resolves.toBe("stream-1");
		await expect(getResumableChatStreamId({ chatId, organizationId })).resolves.toBe("stream-1");
		await cancelStream({ chatId, organizationId });

		expect(redis.eval).toHaveBeenCalledWith(
			expect.stringContaining("redis.call('exists', KEYS[1])"),
			4,
			`chat-stream-shutdown:${organizationId}`,
			`chat-stream-active:${organizationId}:${chatId}`,
			`chat-stream-resumable:${organizationId}:${chatId}`,
			`chat-stream-executions:${organizationId}`,
			"stream-1",
			JSON.stringify([chatId, "stream-1"]),
			86_400,
			`chat-stream-active:${organizationId}:`
		);
		expect(redis.del).toHaveBeenCalledWith(
			`chat-stream-active:${organizationId}:${chatId}`,
			`chat-stream-resumable:${organizationId}:${chatId}`
		);
	});

	it("rejects a stream registration that races organization shutdown", async () => {
		redis.eval.mockResolvedValueOnce(0);

		await expect(setChatStreamId({ chatId, organizationId, streamId: "stream-1" })).resolves.toBe(false);
	});

	it("clears active and resumable pointers independently and only for their owner", async () => {
		await clearActiveChatStreamId({ chatId, organizationId, streamId: "stream-1" });
		await clearResumableChatStreamId({ chatId, organizationId, streamId: "stream-1" });

		expect(redis.eval).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("ARGV[1]"),
			2,
			`chat-stream-active:${organizationId}:${chatId}`,
			`chat-stream-executions:${organizationId}`,
			"stream-1",
			JSON.stringify([chatId, "stream-1"])
		);
		expect(redis.eval).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("ARGV[1]"),
			1,
			`chat-stream-resumable:${organizationId}:${chatId}`,
			"stream-1"
		);
	});

	it("owns, renews, and clears the shutdown lease before reporting active executions", async () => {
		redis.set.mockResolvedValueOnce("OK");
		redis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
		redis.scard.mockResolvedValueOnce(2);

		const lease = await beginOrganizationAIShutdown({ organizationId });
		await expect(renewOrganizationAIShutdown({ lease, ttlSeconds: 900 })).resolves.toBe(true);
		await expect(getOrganizationActiveStreamCount({ organizationId })).resolves.toBe(2);
		await clearOrganizationAIShutdown({ lease });

		expect(redis.set).toHaveBeenCalledWith(`chat-stream-shutdown:${organizationId}`, lease.token, "EX", 60, "NX");
		expect(redis.eval).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("expire"),
			1,
			`chat-stream-shutdown:${organizationId}`,
			lease.token,
			900
		);
		expect(redis.eval).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("del"),
			1,
			`chat-stream-shutdown:${organizationId}`,
			lease.token
		);
		expect(redis.scard).toHaveBeenCalledWith(`chat-stream-executions:${organizationId}`);
	});

	it("rejects a concurrent organization shutdown without replacing its owner", async () => {
		redis.set.mockResolvedValueOnce(null);

		await expect(beginOrganizationAIShutdown({ organizationId })).rejects.toThrow(
			"Organization AI shutdown is already in progress"
		);
	});

	it("claims each assistant continuation once", async () => {
		redis.set.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);

		const input = {
			chatId,
			claimId: "stream-1",
			continuationId: "transition-1",
			messageId: "assistant-1",
			organizationId,
		};

		await expect(claimChatContinuation(input)).resolves.toBe(true);
		await expect(claimChatContinuation(input)).resolves.toBe(false);
		expect(redis.set).toHaveBeenCalledWith(
			`chat-continuation:${organizationId}:${chatId}:assistant-1:transition-1`,
			"stream-1",
			"EX",
			604_800,
			"NX"
		);
	});

	it("claims a user message globally and releases only the owning failed stream", async () => {
		redis.set.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);

		await expect(claimChatMessage({ claimId: "stream-1", messageId: "message-1" })).resolves.toBe(true);
		await expect(claimChatMessage({ claimId: "stream-2", messageId: "message-1" })).resolves.toBe(false);
		await releaseChatMessage({ claimId: "stream-1", messageId: "message-1" });

		expect(redis.set).toHaveBeenNthCalledWith(1, "chat-message:message-1", "stream-1", "EX", 604_800, "NX");
		expect(redis.eval).toHaveBeenCalledWith(
			expect.stringContaining("ARGV[1]"),
			1,
			"chat-message:message-1",
			"stream-1"
		);
	});
});
