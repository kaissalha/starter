import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";

import { ChatSessionRuntime } from "@/components/chat/stores/chat-session-runtime";
import type { ChatSessionState } from "@/components/chat/stores/chat-session-store";
import type { DashboardChatUIMessage } from "@starter/server";

import { mockOrganizationPermissions } from "../mocks/organization-permissions";

type ChatMockState = {
	error: Error | undefined;
	messages: Array<DashboardChatUIMessage>;
	status: "ready" | "streaming";
};

const chatMocks = vi.hoisted(() => {
	const state: ChatMockState = { error: undefined, messages: [], status: "ready" };

	return {
		addToolApprovalResponse: vi.fn(),
		addToolOutput: vi.fn(),
		getMessages: vi.fn(),
		regenerate: vi.fn(),
		reportError: vi.fn(),
		resumeStream: vi.fn(),
		sendMessage: vi.fn(),
		setMessages: vi.fn(),
		state,
		stop: vi.fn(),
		useChat: vi.fn(),
	};
});

vi.mock("@/lib/api-client", () => ({
	client: { chats: { cancelStream: vi.fn(), messages: chatMocks.getMessages } },
}));

vi.mock("@ai-sdk/react", () => ({
	useChat: chatMocks.useChat,
}));

const createChatStore = () =>
	createStore<ChatSessionState>()(() => ({
		actions: undefined,
		error: undefined,
		messages: [],
		status: "ready",
	}));

const renderRuntime = (store: ReturnType<typeof createChatStore>) =>
	render(<ChatSessionRuntime autoResume={false} chatId='chat-1' initialMessages={[]} store={store} />);

const getSendMessage = (store: ReturnType<typeof createChatStore>) => {
	const sendMessage = store.getState().actions?.sendMessage;

	if (!sendMessage) {
		throw new Error("Chat runtime actions were not initialized.");
	}

	return sendMessage;
};

describe("ChatSessionRuntime", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		chatMocks.state.error = undefined;
		chatMocks.state.messages = [];
		chatMocks.state.status = "ready";
		chatMocks.sendMessage.mockResolvedValue(undefined);
		chatMocks.useChat.mockImplementation((options) => {
			chatMocks.reportError.mockImplementation((error) => options.onError?.(error));

			return {
				addToolApprovalResponse: chatMocks.addToolApprovalResponse,
				addToolOutput: chatMocks.addToolOutput,
				error: chatMocks.state.error,
				messages: chatMocks.state.messages,
				regenerate: chatMocks.regenerate,
				resumeStream: chatMocks.resumeStream,
				sendMessage: chatMocks.sendMessage,
				setMessages: chatMocks.setMessages,
				status: chatMocks.state.status,
				stop: chatMocks.stop,
			};
		});
	});

	it("notifies affected data subscribers once for each batch of newly completed actions", async () => {
		const historical: DashboardChatUIMessage = {
			id: "historical",
			parts: [
				{
					input: { revision: "1" },
					output: { revision: "2" },
					state: "output-available",
					toolCallId: "historical-brand",
					type: "tool-publishBrand",
				},
			],
			role: "assistant",
		};

		const initialMessages = [historical];
		chatMocks.state.messages = initialMessages;
		const store = createChatStore();
		const onDataChange = { brand: vi.fn(), links: vi.fn(), website: vi.fn() };

		const runtime = render(
			<ChatSessionRuntime
				autoResume={false}
				chatId='chat-1'
				initialMessages={initialMessages}
				onDataChange={onDataChange}
				store={store}
			/>
		);

		expect(onDataChange.links).not.toHaveBeenCalled();
		expect(onDataChange.website).not.toHaveBeenCalled();

		const edit: DashboardChatUIMessage = {
			id: "edit",
			parts: [
				{
					input: {
						edits: [{ operation: "update-profile", title: { en: "Updated" } }],
						updatedAt: "2026-09-12T00:00:00.000Z",
					},
					output: { hasUnpublishedChanges: true, updatedAt: "2026-09-12T00:00:01.000Z" },
					state: "output-available",
					toolCallId: "links-edit",
					type: "tool-editLinkPage",
				},
			],
			role: "assistant",
		};

		chatMocks.state.messages = [
			historical,
			edit,
			{
				...historical,
				id: "new-brand",
				parts: [
					{
						input: { revision: "2", update: { cornerStyle: "rounded" } },
						output: { revision: "3" },
						state: "output-available",
						toolCallId: "new-brand",
						type: "tool-updateBrand",
					},
				],
			},
		];
		runtime.rerender(
			<ChatSessionRuntime
				autoResume={false}
				chatId='chat-1'
				initialMessages={initialMessages}
				onDataChange={onDataChange}
				store={store}
			/>
		);
		await waitFor(() => expect(onDataChange.links).toHaveBeenCalledOnce());
		expect(onDataChange.website).toHaveBeenCalledOnce();
		expect(onDataChange.brand).toHaveBeenCalledOnce();

		chatMocks.state.messages = [...chatMocks.state.messages];
		runtime.rerender(
			<ChatSessionRuntime
				autoResume={false}
				chatId='chat-1'
				initialMessages={initialMessages}
				onDataChange={onDataChange}
				store={store}
			/>
		);
		expect(onDataChange.links).toHaveBeenCalledOnce();
		expect(onDataChange.website).toHaveBeenCalledOnce();
	});

	it("ignores reads, failed actions and pending approvals, then notifies when the action completes", async () => {
		const input = { revision: "1" };

		const messages: Array<DashboardChatUIMessage> = [
			{
				id: "actions",
				parts: [
					{
						input: {},
						output: { cornerStyles: [], fontPairings: [] },
						state: "output-available",
						toolCallId: "read",
						type: "tool-listBrandOptions",
					},
					{
						errorText: "Conflict",
						input,
						state: "output-error",
						toolCallId: "failed",
						type: "tool-publishBrand",
					},
					{
						approval: { id: "approval" },
						input,
						state: "approval-requested",
						toolCallId: "pending",
						type: "tool-publishBrand",
					},
				],
				role: "assistant",
			},
		];

		chatMocks.state.messages = messages;
		const store = createChatStore();
		const website = vi.fn();

		const runtime = render(
			<ChatSessionRuntime
				autoResume={false}
				chatId='chat-1'
				initialMessages={[]}
				onDataChange={{ website }}
				store={store}
			/>
		);

		expect(website).not.toHaveBeenCalled();
		chatMocks.state.messages = [
			{
				id: "actions",
				parts: [
					{
						input,
						output: { revision: "2" },
						state: "output-available",
						toolCallId: "pending",
						type: "tool-publishBrand",
					},
				],
				role: "assistant",
			},
		];
		runtime.rerender(
			<ChatSessionRuntime
				autoResume={false}
				chatId='chat-1'
				initialMessages={[]}
				onDataChange={{ website }}
				store={store}
			/>
		);
		await waitFor(() => expect(website).toHaveBeenCalledOnce());
	});

	it("rejects a send when the SDK reports a shutdown HTTP error but resolves its raw promise", async () => {
		const store = createChatStore();
		chatMocks.sendMessage.mockImplementation(async () => {
			chatMocks.reportError(new Error("This organization is being deleted."));
		});
		renderRuntime(store);
		await waitFor(() => expect(store.getState().actions).toBeDefined());

		await expect(getSendMessage(store)({ text: "Keep this draft" })).rejects.toThrow(
			"This organization is being deleted."
		);
		expect(chatMocks.sendMessage).toHaveBeenCalledOnce();
	});

	it("resyncs to the persisted messages and shows a localized error when an approval continuation fails", async () => {
		const part = {
			input: { revision: "1" },
			toolCallId: "call-1",
			type: "tool-publishBrand" as const,
		};

		const responded: DashboardChatUIMessage = {
			id: "assistant-1",
			parts: [{ ...part, approval: { approved: true, id: "run::call-1" }, state: "approval-responded" }],
			role: "assistant",
		};

		const persisted: DashboardChatUIMessage = {
			id: "assistant-1",
			parts: [{ ...part, approval: { id: "run::call-1" }, state: "approval-requested" }],
			role: "assistant",
		};

		chatMocks.state.messages = [responded];
		chatMocks.state.error = new Error(
			JSON.stringify({ error: { message: "Assistant continuation does not match the pending request." } })
		);
		chatMocks.getMessages.mockResolvedValue([persisted]);
		const store = createChatStore();
		renderRuntime(store);

		await waitFor(() => expect(chatMocks.setMessages).toHaveBeenCalledWith([persisted]));
		expect(chatMocks.getMessages).toHaveBeenCalledWith({ chatId: "chat-1" });
		expect(store.getState().error?.message).toBe("continuationMismatch");
	});

	it("does not resync after a failed new message and unwraps its server error", async () => {
		chatMocks.state.messages = [{ id: "user-1", parts: [{ text: "Hi", type: "text" }], role: "user" }];
		chatMocks.state.error = new Error(JSON.stringify({ error: { message: "Chat request limit reached." } }));
		const store = createChatStore();
		renderRuntime(store);

		await waitFor(() => expect(store.getState().error?.message).toBe("Chat request limit reached."));
		expect(chatMocks.getMessages).not.toHaveBeenCalled();
	});

	it("accepts a send when streaming starts without waiting for the full response", async () => {
		const response = Promise.withResolvers<void>();
		chatMocks.sendMessage.mockReturnValue(response.promise);
		const store = createChatStore();
		const runtime = renderRuntime(store);
		await waitFor(() => expect(store.getState().actions).toBeDefined());

		const send = getSendMessage(store)({ text: "Hello" });
		const accepted = vi.fn();

		const recordAcceptance = async () => {
			await send;
			accepted();
		};

		recordAcceptance();
		await waitFor(() => expect(chatMocks.sendMessage).toHaveBeenCalledOnce());
		expect(accepted).not.toHaveBeenCalled();

		chatMocks.state.status = "streaming";
		runtime.rerender(<ChatSessionRuntime autoResume={false} chatId='chat-1' initialMessages={[]} store={store} />);

		await expect(send).resolves.toBeUndefined();
		expect(accepted).toHaveBeenCalledOnce();
		response.resolve();
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
