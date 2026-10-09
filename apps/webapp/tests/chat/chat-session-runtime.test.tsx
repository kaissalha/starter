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
	render(<ChatSessionRuntime chatId='chat-1' initialMessages={[]} store={store} />);

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
					input: { content: "# Notes", name: "Notes" },
					output: { id: "asset-1" },
					state: "output-available",
					toolCallId: "historical-create",
					type: "tool-createLibraryDocument",
				},
			],
			role: "assistant",
		};

		const initialMessages = [historical];
		chatMocks.state.messages = initialMessages;
		const store = createChatStore();
		const onDataChange = { library: vi.fn() };

		const runtime = render(
			<ChatSessionRuntime
				chatId='chat-1'
				initialMessages={initialMessages}
				onDataChange={onDataChange}
				store={store}
			/>
		);

		expect(onDataChange.library).not.toHaveBeenCalled();

		chatMocks.state.messages = [
			historical,
			{
				id: "edit",
				parts: [
					{
						input: {
							assetId: "asset-1",
							edits: [{ find: "Notes", replace: "Updated" }],
							updatedAt: "2026-09-12T00:00:00.000Z",
						},
						output: { id: "asset-1" },
						state: "output-available",
						toolCallId: "library-edit",
						type: "tool-editLibraryDocument",
					},
					{
						input: { content: "# Plan", name: "Plan" },
						output: { id: "asset-2" },
						state: "output-available",
						toolCallId: "library-create",
						type: "tool-createLibraryDocument",
					},
				],
				role: "assistant",
			},
		];
		runtime.rerender(
			<ChatSessionRuntime
				chatId='chat-1'
				initialMessages={initialMessages}
				onDataChange={onDataChange}
				store={store}
			/>
		);
		await waitFor(() => expect(onDataChange.library).toHaveBeenCalledOnce());

		chatMocks.state.messages = [...chatMocks.state.messages];
		runtime.rerender(
			<ChatSessionRuntime
				chatId='chat-1'
				initialMessages={initialMessages}
				onDataChange={onDataChange}
				store={store}
			/>
		);
		expect(onDataChange.library).toHaveBeenCalledOnce();
	});

	it("ignores reads, failed actions and pending approvals, then notifies when the action completes", async () => {
		const input = { content: "# Notes", name: "Notes" };

		const messages: Array<DashboardChatUIMessage> = [
			{
				id: "actions",
				parts: [
					{
						input: { assetId: "550e8400-e29b-41d4-a716-446655440000" },
						output: { id: "asset-1" },
						state: "output-available",
						toolCallId: "read",
						type: "tool-getLibraryAsset",
					},
					{
						errorText: "Conflict",
						input,
						state: "output-error",
						toolCallId: "failed",
						type: "tool-createLibraryDocument",
					},
					{
						approval: { id: "approval" },
						input,
						state: "approval-requested",
						toolCallId: "pending",
						type: "tool-createLibraryDocument",
					},
				],
				role: "assistant",
			},
		];

		chatMocks.state.messages = messages;
		const store = createChatStore();
		const library = vi.fn();

		const runtime = render(
			<ChatSessionRuntime chatId='chat-1' initialMessages={[]} onDataChange={{ library }} store={store} />
		);

		expect(library).not.toHaveBeenCalled();
		chatMocks.state.messages = [
			{
				id: "actions",
				parts: [
					{
						input,
						output: { id: "asset-1" },
						state: "output-available",
						toolCallId: "pending",
						type: "tool-createLibraryDocument",
					},
				],
				role: "assistant",
			},
		];
		runtime.rerender(
			<ChatSessionRuntime chatId='chat-1' initialMessages={[]} onDataChange={{ library }} store={store} />
		);
		await waitFor(() => expect(library).toHaveBeenCalledOnce());
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
			input: { content: "# Notes", name: "Notes" },
			toolCallId: "call-1",
			type: "tool-createLibraryDocument" as const,
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
		runtime.rerender(<ChatSessionRuntime chatId='chat-1' initialMessages={[]} store={store} />);

		await expect(send).resolves.toBeUndefined();
		expect(accepted).toHaveBeenCalledOnce();
		response.resolve();
	});

	it("reports a new chat once its first stream starts and never for an existing chat", () => {
		const onChatCreated = vi.fn();
		const store = createChatStore();

		const runtime = (chatId: string, initialMessages: Array<DashboardChatUIMessage>) => (
			<ChatSessionRuntime
				chatId={chatId}
				initialMessages={initialMessages}
				onChatCreated={onChatCreated}
				store={store}
			/>
		);

		const view = render(runtime("chat-1", []));

		for (const status of ["streaming", "ready", "streaming"] as const) {
			chatMocks.state.status = status;
			view.rerender(runtime("chat-1", []));
		}

		expect(onChatCreated).toHaveBeenCalledExactlyOnceWith("chat-1");

		render(runtime("chat-2", [{ id: "m1", parts: [{ text: "Hi", type: "text" }], role: "user" }]));
		expect(onChatCreated).toHaveBeenCalledOnce();
	});

	it("enables the AI SDK's built-in stream resumption", () => {
		render(<ChatSessionRuntime chatId='chat-1' initialMessages={[]} store={createChatStore()} />);

		expect(chatMocks.useChat).toHaveBeenCalledWith(expect.objectContaining({ id: "chat-1", resume: true }));
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
