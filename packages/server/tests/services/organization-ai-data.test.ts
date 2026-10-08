import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	beginOrganizationAIShutdown: vi.fn(),
	cancelStream: vi.fn(),
	clearOrganizationAIShutdown: vi.fn(),
	deleteKnowledgeOrganization: vi.fn(),
	deleteThread: vi.fn(),
	flush: vi.fn(),
	getOrganizationActiveStreamCount: vi.fn(),
	getResourceById: vi.fn(),
	listThreads: vi.fn(),
	renewOrganizationAIShutdown: vi.fn(),
	updateResource: vi.fn(),
}));

vi.mock("../../src/mastra/memory", () => ({
	dashboardChatMemory: {
		deleteThread: mocks.deleteThread,
		listThreads: mocks.listThreads,
	},
	mastraStorage: {
		getStore: async () => ({ getResourceById: mocks.getResourceById, updateResource: mocks.updateResource }),
	},
}));

vi.mock("../../src/mastra", () => ({ flushMastraObservability: mocks.flush }));

vi.mock("../../src/mastra/knowledge", () => ({ deleteKnowledgeOrganization: mocks.deleteKnowledgeOrganization }));

vi.mock("../../src/services/chat-stream-state", () => ({
	beginOrganizationAIShutdown: mocks.beginOrganizationAIShutdown,
	cancelStream: mocks.cancelStream,
	clearOrganizationAIShutdown: mocks.clearOrganizationAIShutdown,
	getOrganizationActiveStreamCount: mocks.getOrganizationActiveStreamCount,
	renewOrganizationAIShutdown: mocks.renewOrganizationAIShutdown,
}));

import { deleteOrganizationAIData, stopOrganizationAIActivity } from "../../src/services/organization-ai-data";

type ListThreadsResolution = { value?: (result: { threads: Array<{ id: string }> }) => void };

describe("organization AI data cleanup", () => {
	const lease = { organizationId: "organization-1", token: "lease-1" };

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.beginOrganizationAIShutdown.mockResolvedValue(lease);
		mocks.getOrganizationActiveStreamCount.mockResolvedValue(0);
		mocks.listThreads.mockResolvedValue({ threads: [{ id: "thread-1" }, { id: "thread-2" }] });
		mocks.renewOrganizationAIShutdown.mockResolvedValue(true);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("stops more than one legacy page of organization chats before database cascades run", async () => {
		const threads = Array.from({ length: 101 }, (_, index) => ({ id: `thread-${index}` }));
		mocks.listThreads.mockResolvedValueOnce({ threads });

		await stopOrganizationAIActivity({ organizationId: "organization-1" });

		expect(mocks.beginOrganizationAIShutdown).toHaveBeenCalledWith({ organizationId: "organization-1" });
		expect(mocks.listThreads).toHaveBeenCalledWith({
			filter: { resourceId: "organization-1" },
			perPage: false,
		});
		expect(mocks.cancelStream).toHaveBeenCalledTimes(101);
		expect(mocks.cancelStream).toHaveBeenCalledWith({
			chatId: "thread-100",
			organizationId: "organization-1",
		});
		expect(mocks.flush).toHaveBeenCalledOnce();
		expect(mocks.renewOrganizationAIShutdown).toHaveBeenCalledWith({ lease, ttlSeconds: 900 });
		expect(mocks.beginOrganizationAIShutdown.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.listThreads.mock.invocationCallOrder[0] ?? 0
		);
		expect(mocks.getOrganizationActiveStreamCount.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.flush.mock.invocationCallOrder[0] ?? 0
		);
	});

	it("renews the owned shutdown lease during long pre-delete cleanup", async () => {
		vi.useFakeTimers();
		const listThreadsResolution: ListThreadsResolution = {};
		mocks.listThreads.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					listThreadsResolution.value = resolve;
				})
		);

		const cleanup = stopOrganizationAIActivity({ organizationId: "organization-1" });
		await vi.advanceTimersByTimeAsync(20_000);
		listThreadsResolution.value?.({ threads: [] });
		await cleanup;

		expect(mocks.renewOrganizationAIShutdown).toHaveBeenNthCalledWith(1, { lease });
		expect(mocks.renewOrganizationAIShutdown).toHaveBeenLastCalledWith({ lease, ttlSeconds: 900 });
	});

	it("waits for every registered organization execution before flushing", async () => {
		vi.useFakeTimers();
		mocks.getOrganizationActiveStreamCount
			.mockResolvedValueOnce(2)
			.mockResolvedValueOnce(1)
			.mockResolvedValueOnce(0);

		const cleanup = stopOrganizationAIActivity({ organizationId: "organization-1" });
		await vi.advanceTimersByTimeAsync(100);
		await cleanup;

		expect(mocks.getOrganizationActiveStreamCount).toHaveBeenCalledTimes(3);
		expect(mocks.flush).toHaveBeenCalledOnce();
	});

	it("fails closed when an execution does not acknowledge cancellation before the deadline", async () => {
		vi.useFakeTimers();
		mocks.getOrganizationActiveStreamCount.mockResolvedValue(1);

		const cleanup = stopOrganizationAIActivity({ organizationId: "organization-1" });
		await Promise.all([
			expect(cleanup).rejects.toThrow("Timed out waiting for organization AI activity to stop"),
			vi.advanceTimersByTimeAsync(5000),
		]);

		expect(mocks.flush).not.toHaveBeenCalled();
		expect(mocks.clearOrganizationAIShutdown).toHaveBeenCalledWith({ lease });
	});

	it("fails closed when an active stream cannot be stopped", async () => {
		mocks.cancelStream.mockRejectedValueOnce(new Error("redis unavailable"));

		await expect(stopOrganizationAIActivity({ organizationId: "organization-1" })).rejects.toThrow(
			"redis unavailable"
		);
		expect(mocks.clearOrganizationAIShutdown).toHaveBeenCalledWith({ lease });
	});

	it("deletes every Mastra thread and the knowledge vectors of a removed organization", async () => {
		const threads = Array.from({ length: 101 }, (_, index) => ({ id: `thread-${index}` }));
		mocks.listThreads.mockResolvedValueOnce({ threads });

		await deleteOrganizationAIData({ organizationId: "organization-1" });

		expect(mocks.listThreads).toHaveBeenCalledWith({
			filter: { resourceId: "organization-1" },
			perPage: false,
		});
		expect(mocks.deleteThread).toHaveBeenCalledTimes(101);
		expect(mocks.deleteThread).toHaveBeenCalledWith("thread-100");
		expect(mocks.deleteKnowledgeOrganization).toHaveBeenCalledWith({ organizationId: "organization-1" });
		expect(mocks.updateResource).not.toHaveBeenCalled();
		expect(mocks.deleteThread.mock.invocationCallOrder.at(-1)).toBeLessThan(
			mocks.deleteKnowledgeOrganization.mock.invocationCallOrder[0] ?? 0
		);
	});

	it("blanks the organization working memory without creating a missing resource", async () => {
		mocks.getResourceById.mockResolvedValueOnce({ id: "organization-1" });

		await deleteOrganizationAIData({ organizationId: "organization-1" });

		expect(mocks.getResourceById).toHaveBeenCalledWith({ resourceId: "organization-1" });
		expect(mocks.updateResource).toHaveBeenCalledWith({ resourceId: "organization-1", workingMemory: "" });
	});

	it("does not drop knowledge vectors when a thread deletion fails", async () => {
		mocks.deleteThread.mockRejectedValueOnce(new Error("storage unavailable"));

		await expect(deleteOrganizationAIData({ organizationId: "organization-1" })).rejects.toThrow(
			"storage unavailable"
		);
		expect(mocks.deleteKnowledgeOrganization).not.toHaveBeenCalled();
	});
});
