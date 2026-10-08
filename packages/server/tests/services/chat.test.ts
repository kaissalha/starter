import type { MastraDBMessage } from "@mastra/core/agent";
import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = vi.hoisted(() => ({
	createThread: vi.fn(),
	getThreadById: vi.fn(),
	listThreads: vi.fn(),
	recall: vi.fn(),
	updateMessages: vi.fn(),
}));

const memoryStore = vi.hoisted(() => ({ listMessagesById: vi.fn() }));

const database = vi.hoisted(() => ({
	client: { query: vi.fn(), release: vi.fn() },
	pool: { connect: vi.fn() },
}));

vi.mock("@starter/db", () => ({ pool: database.pool }));

vi.mock("../../src/mastra/memory", () => ({
	dashboardChatMemory: { ...memory, storage: { getStore: vi.fn(async () => memoryStore) } },
}));

import {
	chatMessageIdExists,
	convertChatMessagesForUI,
	createChat,
	expireChatToolApprovals,
	getChat,
	getChatWithMessages,
	getChats,
	persistChatQuestionAnswers,
} from "../../src/services/chat";

const organizationId = "org-1";

const thread = {
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
	metadata: { purpose: "dashboard" },
	resourceId: organizationId,
	title: "Chat",
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const threadPage = { hasMore: false, page: 0, perPage: 20, threads: [thread], total: 1 };

describe("chat service", () => {
	it("persists question answers before recall without changing other parts or metadata", async () => {
		const questions = { questions: [{ freeText: true, id: "tone", title: "Which tone?" }] };

		const output = {
			answers: [{ otherText: "Warm", question: "Which tone?", questionId: "tone", selectedOptions: [] }],
		};

		const persisted: MastraDBMessage = {
			content: {
				format: 2,
				metadata: { retained: true },
				parts: [
					{ text: "Choose a tone.", type: "text" },
					{
						toolInvocation: {
							args: questions,
							state: "call",
							toolCallId: "question",
							toolName: "askUserQuestions",
						},
						type: "tool-invocation",
					},
					{
						toolInvocation: {
							args: {},
							result: { name: "Brand" },
							state: "result",
							toolCallId: "read",
							toolName: "getBrand",
						},
						type: "tool-invocation",
					},
				],
			},
			createdAt: new Date(),
			id: "assistant",
			role: "assistant",
		};

		await persistChatQuestionAnswers({
			message: {
				id: "assistant",
				parts: [
					{
						input: questions,
						output,
						state: "output-available",
						toolCallId: "question",
						type: "tool-askUserQuestions",
					},
				],
				role: "assistant",
			},
			persistedMessages: [persisted],
		});
		const [updated] = memory.updateMessages.mock.calls[0][0].messages;
		expect(updated.content.metadata).toEqual(persisted.content.metadata);
		expect(updated.content.parts[0]).toEqual(persisted.content.parts[0]);
		expect(updated.content.parts[2]).toEqual(persisted.content.parts[2]);
		const [reloaded] = await convertChatMessagesForUI([{ ...persisted, ...updated }]);
		expect(reloaded.parts).toContainEqual(
			expect.objectContaining({ output, state: "output-available", toolCallId: "question" })
		);
		expect(persisted.content.parts[1]).toMatchObject({ toolInvocation: { state: "call" } });
	});
	beforeEach(() => {
		vi.resetAllMocks();
		database.client.query.mockResolvedValue({ rows: [] });
		database.pool.connect.mockResolvedValue(database.client);
	});

	it("creates organization-owned Mastra threads and confirms ownership after the upsert", async () => {
		memory.getThreadById.mockResolvedValueOnce(null).mockResolvedValueOnce(thread);
		memory.createThread.mockResolvedValue(thread);

		await expect(createChat({ id: thread.id, organizationId, title: thread.title })).resolves.toEqual(thread);

		expect(memory.createThread).toHaveBeenCalledWith({
			resourceId: organizationId,
			threadId: thread.id,
			title: thread.title,
		});
		expect(database.client.query).toHaveBeenNthCalledWith(
			2,
			"SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
			[thread.id]
		);
		expect(database.client.query).toHaveBeenLastCalledWith("COMMIT");
		expect(database.client.release).toHaveBeenCalledOnce();
	});

	it("returns an existing thread the organization already owns without rewriting it", async () => {
		memory.getThreadById.mockResolvedValue(thread);

		await expect(createChat({ id: thread.id, organizationId, title: "Other title" })).resolves.toEqual(thread);
		expect(memory.createThread).not.toHaveBeenCalled();
	});

	it("rejects a thread id already owned by another organization", async () => {
		memory.getThreadById.mockResolvedValue({ ...thread, resourceId: "org-2" });

		await expect(createChat({ id: thread.id, organizationId, title: thread.title })).rejects.toThrow(
			"already owned by another organization"
		);
		expect(memory.createThread).not.toHaveBeenCalled();
	});

	it("surfaces the original error when ROLLBACK also fails", async () => {
		memory.getThreadById.mockRejectedValue(new Error("Memory unavailable"));
		database.client.query.mockImplementation(async (statement: string) => {
			if (statement === "ROLLBACK") {
				throw new Error("Connection lost");
			}

			return { rows: [] };
		});

		await expect(createChat({ id: thread.id, organizationId })).rejects.toThrow("Memory unavailable");
		expect(database.client.release).toHaveBeenCalledOnce();
	});

	it("rejects a thread whose ownership changed while it was being created", async () => {
		memory.getThreadById.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...thread, resourceId: "org-2" });
		memory.createThread.mockResolvedValue(thread);

		await expect(createChat({ id: thread.id, organizationId, title: thread.title })).rejects.toThrow(
			"already owned by another organization"
		);
	});

	it("checks message ids across every thread before Mastra upserts", async () => {
		memoryStore.listMessagesById.mockResolvedValueOnce({ messages: [{ id: "message-1" }] });
		memoryStore.listMessagesById.mockResolvedValueOnce({ messages: [] });

		await expect(chatMessageIdExists("message-1")).resolves.toBe(true);
		await expect(chatMessageIdExists("message-2")).resolves.toBe(false);
		expect(memoryStore.listMessagesById).toHaveBeenCalledWith({ messageIds: ["message-1"] });
	});

	it("scopes thread reads and pagination to the organization", async () => {
		memory.getThreadById.mockResolvedValue(thread);
		memory.listThreads.mockResolvedValue(threadPage);

		await expect(getChat(thread.id, organizationId)).resolves.toEqual(thread);
		await expect(getChats({ organizationId })).resolves.toEqual({ chats: [thread], nextPage: null });

		expect(memory.getThreadById).toHaveBeenCalledWith({ resourceId: organizationId, threadId: thread.id });
		expect(memory.listThreads).toHaveBeenCalledWith({
			filter: { resourceId: organizationId },
			orderBy: { direction: "DESC", field: "updatedAt" },
			page: 0,
			perPage: 20,
		});
	});

	it("reports the next page while Mastra has more threads", async () => {
		memory.listThreads.mockResolvedValue({ ...threadPage, hasMore: true, page: 1 });

		await expect(getChats({ organizationId, page: 1 })).resolves.toEqual({ chats: [thread], nextPage: 2 });
		expect(memory.listThreads).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
	});

	it("hides Library chats from the history and skips pages that hold nothing else", async () => {
		const libraryThread = { ...thread, id: "library-thread", metadata: { libraryChat: "user-1:library" } };
		memory.listThreads
			.mockResolvedValueOnce({ ...threadPage, hasMore: true, threads: [libraryThread] })
			.mockResolvedValueOnce({ ...threadPage, hasMore: true, page: 1, threads: [libraryThread, thread] });

		await expect(getChats({ organizationId })).resolves.toEqual({ chats: [thread], nextPage: 2 });
		expect(memory.listThreads).toHaveBeenCalledTimes(2);
		expect(memory.listThreads).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
	});

	it("loads and converts authorized Mastra messages", async () => {
		const message = {
			content: { format: 2 as const, parts: [{ text: "Hello", type: "text" as const }] },
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			id: "message-1",
			resourceId: organizationId,
			role: "user" as const,
			threadId: thread.id,
		};

		memory.getThreadById.mockResolvedValue(thread);
		memory.recall.mockResolvedValue({ messages: [message] });

		await expect(getChatWithMessages({ chatId: thread.id, organizationId })).resolves.toEqual({
			...thread,
			messages: [message],
		});
		await expect(convertChatMessagesForUI([message])).resolves.toEqual([
			expect.objectContaining({
				id: message.id,
				metadata: expect.objectContaining({ createdAt: message.createdAt.toISOString() }),
				parts: [{ text: "Hello", type: "text" }],
				role: "user",
			}),
		]);
	});

	it("persists missing-snapshot approvals as terminal tool errors", async () => {
		const message = {
			content: {
				format: 2 as const,
				metadata: {
					pendingToolApprovals: {
						"tool-call": { runId: "missing-run", toolCallId: "tool-call" },
						"valid-call": { runId: "valid-run", toolCallId: "valid-call" },
					},
				},
				parts: [
					{
						toolInvocation: {
							args: { revision: "revision-1" },
							state: "call" as const,
							toolCallId: "tool-call",
							toolName: "buildWebsite",
						},
						type: "tool-invocation" as const,
					},
				],
			},
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			id: "assistant-message",
			resourceId: organizationId,
			role: "assistant" as const,
			threadId: thread.id,
		} satisfies MastraDBMessage;

		await expireChatToolApprovals({ message, toolCallIds: ["tool-call"] });

		expect(memory.updateMessages).toHaveBeenCalledWith({
			messages: [
				expect.objectContaining({
					content: expect.objectContaining({
						metadata: {
							pendingToolApprovals: {
								"valid-call": { runId: "valid-run", toolCallId: "valid-call" },
							},
						},
						parts: [
							expect.objectContaining({
								toolInvocation: expect.objectContaining({
									errorText: "This approval expired before Mastra could resume it. Please try again.",
									state: "output-error",
								}),
							}),
						],
					}),
					id: message.id,
				}),
			],
		});

		memory.updateMessages.mockClear();
		await expireChatToolApprovals({ message, toolCallIds: ["tool-call", "valid-call"] });

		expect(memory.updateMessages).toHaveBeenCalledWith({
			messages: [
				expect.objectContaining({
					content: expect.objectContaining({ metadata: { pendingToolApprovals: {} } }),
				}),
			],
		});
	});

	it("does not recall messages for an inaccessible thread", async () => {
		memory.getThreadById.mockResolvedValue(null);

		await expect(getChatWithMessages({ chatId: thread.id, organizationId })).resolves.toBeNull();
		expect(memory.recall).not.toHaveBeenCalled();
	});
});
