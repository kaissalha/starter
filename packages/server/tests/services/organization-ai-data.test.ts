import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	cancelChatStream: vi.fn(),
	deleteKnowledgeOrganization: vi.fn(),
	deleteThread: vi.fn(),
	getResourceById: vi.fn(),
	listThreads: vi.fn(),
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

vi.mock("../../src/mastra/knowledge", () => ({ deleteKnowledgeOrganization: mocks.deleteKnowledgeOrganization }));

vi.mock("../../src/services/chat-stream-state", () => ({ cancelChatStream: mocks.cancelChatStream }));

import { deleteOrganizationAIData } from "../../src/services/organization-ai-data";

describe("organization AI data cleanup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.listThreads.mockResolvedValue({ threads: [{ id: "thread-1" }, { id: "thread-2" }] });
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
		expect(mocks.cancelChatStream).toHaveBeenCalledWith({ chatId: "thread-100", organizationId: "organization-1" });
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
