import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardChatUIMessage } from "../../src/ai/types";

const mocks = vi.hoisted(() => ({
	convertChatMessagesForUI: vi.fn(),
	expireChatToolApprovals: vi.fn(),
	getChatMessages: vi.fn(),
	listSuspendedRuns: vi.fn(),
}));

vi.mock("../../src/mastra", () => ({
	mastra: { getAgentById: () => ({ listSuspendedRuns: mocks.listSuspendedRuns }) },
}));

vi.mock("../../src/services/chat", () => ({
	convertChatMessagesForUI: mocks.convertChatMessagesForUI,
	expireChatToolApprovals: mocks.expireChatToolApprovals,
	getChatMessages: mocks.getChatMessages,
}));

import { getReconciledChatMessages } from "../../src/api/chat-approvals";

const pending: DashboardChatUIMessage = {
	id: "assistant-1",
	parts: [
		{
			approval: { id: "run::call-1" },
			input: { content: "# Brief", name: "Brief" },
			state: "approval-requested",
			toolCallId: "call-1",
			type: "tool-createLibraryDocument",
		},
	],
	role: "assistant",
};

describe("getReconciledChatMessages", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getChatMessages.mockResolvedValue([{ id: "assistant-1" }]);
	});

	it("returns a pending approval untouched while Mastra still holds its suspended run", async () => {
		mocks.convertChatMessagesForUI.mockResolvedValue([pending]);
		mocks.listSuspendedRuns.mockResolvedValue({
			runs: [{ toolCalls: [{ requiresApproval: true, toolCallId: "call-1" }] }],
		});

		await expect(getReconciledChatMessages({ chatId: "chat-1", organizationId: "org-1" })).resolves.toEqual([
			pending,
		]);
		expect(mocks.expireChatToolApprovals).not.toHaveBeenCalled();
	});

	it("expires an approval whose suspended run is gone and returns the reconciled history without throwing", async () => {
		const expired: DashboardChatUIMessage = {
			...pending,
			parts: [
				{
					errorText: "expired",
					input: { content: "# Brief", name: "Brief" },
					state: "output-error",
					toolCallId: "call-1",
					type: "tool-createLibraryDocument",
				},
			],
		};

		mocks.convertChatMessagesForUI.mockResolvedValueOnce([pending]).mockResolvedValueOnce([expired]);
		mocks.listSuspendedRuns.mockResolvedValue({ runs: [] });

		await expect(getReconciledChatMessages({ chatId: "chat-1", organizationId: "org-1" })).resolves.toEqual([
			expired,
		]);
		expect(mocks.expireChatToolApprovals).toHaveBeenCalledWith({
			message: { id: "assistant-1" },
			toolCallIds: ["call-1"],
		});
	});
});
