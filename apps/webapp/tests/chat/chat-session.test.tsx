import { useEffect } from "react";

import { render, waitFor } from "@testing-library/react";
import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	ChatSessionProvider,
	isAwaitingApproval,
	isChatSessionBusy,
	useChatSession,
	type ChatSessionConfig,
	type ChatSessionState,
} from "@/components/chat/chat-session";
import type { DashboardChatUIMessage } from "@starter/server";

import { mockOrganizationPermissions } from "../mocks/organization-permissions";

vi.mock("@/lib/api-client", () => ({ client: { chats: { cancelStream: vi.fn(), messages: vi.fn() } } }));

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));

const stateWith = ({
	isLoading = false,
	messages = [],
}: Partial<Pick<ChatSessionState, "isLoading" | "messages">>) => ({ isLoading, messages });

describe("chat session state", () => {
	it("distinguishes manual approvals that replace the ordinary composer", () => {
		const approvalPart = {
			approval: { id: "approval-id" },
			input: { content: "# Notes", name: "Notes" },
			state: "approval-requested" as const,
			toolCallId: "edit-call",
			type: "tool-createLibraryDocument" as const,
		};

		const approvalMessage = {
			id: "approval-message",
			parts: [approvalPart],
			role: "assistant" as const,
		};

		expect(isAwaitingApproval([approvalMessage])).toBe(true);

		expect(
			isAwaitingApproval([
				{
					...approvalMessage,
					parts: [{ ...approvalPart, approval: { id: "approval-id", isAutomatic: true } }],
				},
			])
		).toBe(false);
	});

	it("stays busy through streaming and pending client continuations", () => {
		expect(isChatSessionBusy(stateWith({ isLoading: true }))).toBe(true);

		expect(
			isChatSessionBusy(
				stateWith({
					messages: [
						{
							id: "approval-message",
							parts: [
								{
									approval: { id: "approval-id" },
									input: { content: "# Notes", name: "Notes" },
									state: "approval-requested",
									toolCallId: "edit-call",
									type: "tool-createLibraryDocument",
								},
							],
							role: "assistant",
						},
					],
				})
			)
		).toBe(true);

		expect(
			isChatSessionBusy(
				stateWith({
					messages: [
						{
							id: "question-message",
							parts: [
								{
									input: { questions: [{ freeText: true, id: "tone", title: "Which tone?" }] },
									state: "input-available",
									toolCallId: "question-call",
									type: "tool-askUserQuestions",
								},
							],
							role: "assistant",
						},
					],
				})
			)
		).toBe(true);
	});

	it("is ready when no response or work is pending", () => {
		expect(isChatSessionBusy(stateWith({}))).toBe(false);
	});
});

type CurrentSession = { state?: ChatSessionState };

const fetchMock = vi.fn<typeof fetch>();

const streamResponse = (chunks: Array<UIMessageChunk>) =>
	createUIMessageStreamResponse({
		stream: new ReadableStream({
			start: (controller) => {
				chunks.forEach((chunk) => controller.enqueue(chunk));
				controller.close();
			},
		}),
	});

const completedTool: Array<UIMessageChunk> = [
	{ messageId: "assistant-1", type: "start" },
	{
		input: { content: "# Notes", name: "Notes" },
		toolCallId: "doc-1",
		toolName: "createLibraryDocument",
		type: "tool-input-available",
	},
	{ output: { id: "doc" }, toolCallId: "doc-1", type: "tool-output-available" },
	{ type: "finish" },
];

const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

const postedBody = (index = 0) => JSON.parse(String(posts()[index]?.[1]?.body));

const renderSession = ({
	initialMessages = [],
	runtime,
}: {
	initialMessages?: Array<DashboardChatUIMessage>;
	runtime: ChatSessionConfig;
}) => {
	const current: CurrentSession = {};

	const Probe = () => {
		const state = useChatSession();

		useEffect(() => {
			current.state = state;
		}, [state]);

		return null;
	};

	render(
		<ChatSessionProvider initialMessages={initialMessages} runtime={runtime}>
			<Probe />
		</ChatSessionProvider>
	);

	return current;
};

describe("chat session", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		fetchMock.mockImplementation(async (_input, init) =>
			init?.method === "POST" ? streamResponse(completedTool) : new Response(null, { status: 204 })
		);
		vi.stubGlobal("fetch", fetchMock);
	});

	it("resumes an active stream when it mounts", async () => {
		renderSession({ runtime: { chatId: "chat-1" } });

		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/chats/chat-1/stream", expect.anything()));
	});

	it("accepts a send once the server responds and reports a new chat once", async () => {
		const onChatCreated = vi.fn();
		const session = renderSession({ runtime: { chatId: "chat-1", onChatCreated } });

		await waitFor(() => expect(session.state).toBeDefined());
		await session.state?.actions.sendMessage({ text: "Hi" });

		expect(onChatCreated).toHaveBeenCalledExactlyOnceWith("chat-1");
		expect(postedBody()).toMatchObject({ message: { role: "user" } });
	});

	it("rejects a send the server refuses and never reports an existing chat as created", async () => {
		const onChatCreated = vi.fn();
		fetchMock.mockImplementation(async (_input, init) =>
			init?.method === "POST"
				? Response.json({ error: { message: "Chat request limit reached." } }, { status: 429 })
				: new Response(null, { status: 204 })
		);

		const session = renderSession({
			initialMessages: [{ id: "m1", parts: [{ text: "Earlier", type: "text" }], role: "user" }],
			runtime: { chatId: "chat-1", onChatCreated },
		});

		await waitFor(() => expect(session.state).toBeDefined());
		await expect(session.state?.actions.sendMessage({ text: "Hi" })).rejects.toThrow("Chat request limit reached.");
		expect(onChatCreated).not.toHaveBeenCalled();
	});

	it("sends question answers as a resume of the suspended tool call", async () => {
		const output = { answers: [{ question: "Which tone?", questionId: "tone", selectedOptions: ["Warm"] }] };

		const session = renderSession({
			initialMessages: [
				{
					id: "assistant-1",
					parts: [
						{
							input: { questions: [{ id: "tone", title: "Which tone?" }] },
							state: "input-available",
							toolCallId: "question-1",
							type: "tool-askUserQuestions",
						},
					],
					role: "assistant",
				},
			],
			runtime: { chatId: "chat-1" },
		});

		await waitFor(() => expect(session.state).toBeDefined());
		await session.state?.actions.answerQuestions({ output, toolCallId: "question-1" });

		expect(postedBody()).toMatchObject({
			message: { id: "assistant-1", parts: [{ output, state: "output-available", toolCallId: "question-1" }] },
			resume: { data: output, toolCallId: "question-1" },
		});
	});
});
