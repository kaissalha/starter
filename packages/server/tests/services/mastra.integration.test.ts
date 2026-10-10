import type { MastraDBMessage } from "@mastra/core/agent";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { MastraLanguageModelV2Mock, simulateReadableStream } from "@mastra/core/test-utils/llm-mock";
import { createTool } from "@mastra/core/tools";
import { isToolUIPart } from "ai";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => {
	const restart = vi.fn(async () => undefined);

	return {
		createRun: vi.fn(async () => ({ restart })),
		deleteBlob: vi.fn(),
		getWorkflowRunById: vi.fn(),
		restart,
	};
});

vi.mock("../../src/lib/blob-storage", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/lib/blob-storage")>()),
	deleteBlob: mocks.deleteBlob,
}));

vi.mock("../../src/ai", () => ({
	mastra: {
		getWorkflow: () => ({ createRun: mocks.createRun, getWorkflowRunById: mocks.getWorkflowRunById }),
	},
}));

import { db, files } from "@starter/db";
import { knowledgeEmbeddingDimensions, knowledgeIndexName } from "@starter/db/mastra";

import { knowledgeVector, upsertKnowledgeChunks } from "../../src/ai/knowledge";
import { createDashboardWorkingMemoryProcessor, dashboardChatMemory, mastraStorage } from "../../src/ai/memory";
import { assistantTools } from "../../src/ai/tools/assistant";
import { hasPendingAssistantRequest } from "../../src/api/chat-stream";
import {
	chatMessageIdExists,
	ChatOwnershipConflictError,
	convertChatMessagesForUI,
	createChat,
	getChatMessages,
	saveChatUserMessage,
	getChats,
} from "../../src/services/chat";
import { deleteOrganizationAIData } from "../../src/services/organization-purge";
import {
	createFile,
	deleteFile,
	getFile,
	listKnowledgeDocuments,
	listRetrievableFileIds,
	waitForFilesReady,
} from "../../src/services/storage";
import { cleanupOrganization, createTestOrganization } from "../helpers/db";

const unitVector = (position: number) =>
	Array.from({ length: knowledgeEmbeddingDimensions }, (_, index) => (index === position ? 1 : 0));

const createMessage = ({
	organizationId,
	text,
	threadId,
}: {
	organizationId: string;
	text: string;
	threadId: string;
}): MastraDBMessage => ({
	content: { format: 2, parts: [{ text, type: "text" }] },
	createdAt: new Date(),
	id: uuidv4(),
	resourceId: organizationId,
	role: "user",
	threadId,
});

const insertReadyFile = async ({
	id,
	organizationId,
	storageKey,
}: {
	id: string;
	organizationId: string;
	storageKey?: string;
}) => {
	await db.insert(files).values({
		contentType: "text/plain",
		id,
		kind: "text",
		name: `${id}.txt`,
		organizationId,
		ragStatus: "ready",
		storageKey,
	});
};

const cleanupOrganizationData = async (organizationId: string) => {
	await deleteOrganizationAIData({ organizationId });
	await cleanupOrganization(organizationId);
};

describe("Mastra persistence", () => {
	it("keeps client-chosen chat and message ids inside their organization", async () => {
		const organizationA = await createTestOrganization({ name: "Mastra Ownership A" });
		const organizationB = await createTestOrganization({ name: "Mastra Ownership B" });
		const chatId = uuidv4();
		const messageId = uuidv4();

		try {
			await createChat({ id: chatId, organizationId: organizationA.id, title: "Organization A" });

			await expect(
				createChat({ id: chatId, organizationId: organizationB.id, title: "Organization B" })
			).rejects.toBeInstanceOf(ChatOwnershipConflictError);
			await expect(dashboardChatMemory.getThreadById({ threadId: chatId })).resolves.toMatchObject({
				resourceId: organizationA.id,
				title: "Organization A",
			});

			await dashboardChatMemory.saveMessages({
				messages: [
					{
						...createMessage({ organizationId: organizationA.id, text: "A", threadId: chatId }),
						id: messageId,
					},
				],
			});

			await expect(chatMessageIdExists(messageId)).resolves.toBe(true);
			await expect(chatMessageIdExists(uuidv4())).resolves.toBe(false);
		} finally {
			await Promise.all([cleanupOrganizationData(organizationA.id), cleanupOrganizationData(organizationB.id)]);
		}
	});

	it("atomically assigns a concurrently created chat id to one organization", async () => {
		const organizationA = await createTestOrganization({ name: "Mastra Race A" });
		const organizationB = await createTestOrganization({ name: "Mastra Race B" });
		const chatId = uuidv4();

		try {
			const results = await Promise.allSettled([
				createChat({ id: chatId, organizationId: organizationA.id, title: "Organization A" }),
				createChat({ id: chatId, organizationId: organizationB.id, title: "Organization B" }),
			]);

			const owner = await dashboardChatMemory.getThreadById({ threadId: chatId });

			expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
			expect(results.filter(({ status }) => status === "rejected")).toEqual([
				expect.objectContaining({ reason: expect.any(ChatOwnershipConflictError) }),
			]);
			expect(owner?.resourceId).toBe(results[0]?.status === "fulfilled" ? organizationA.id : organizationB.id);
		} finally {
			await Promise.all([cleanupOrganizationData(organizationA.id), cleanupOrganizationData(organizationB.id)]);
		}
	});

	it("removes knowledge vectors when a file is deleted and refuses to index it again", async () => {
		const organization = await createTestOrganization({ name: "Mastra File Deletion" });
		const fileId = uuidv4();
		const storageKey = `${fileId}.txt`;
		const vectorId = uuidv4();
		const queryVector = unitVector(0);
		const knowledge = knowledgeVector;

		try {
			await insertReadyFile({ id: fileId, organizationId: organization.id, storageKey });
			await knowledge.upsert({
				ids: [vectorId],
				indexName: knowledgeIndexName,
				metadata: [{ fileId, organizationId: organization.id }],
				vectors: [queryVector],
			});

			await expect(
				listRetrievableFileIds({ fileIds: [fileId], organizationId: organization.id })
			).resolves.toEqual([fileId]);
			await expect(deleteFile({ fileId, organizationId: organization.id })).resolves.toBe(true);
			expect(mocks.deleteBlob).toHaveBeenCalledExactlyOnceWith({ access: "public", key: storageKey });
			await expect(deleteFile({ fileId, organizationId: organization.id })).resolves.toBe(false);
			expect(mocks.deleteBlob).toHaveBeenCalledTimes(1);
			await expect(getFile({ fileId, organizationId: organization.id })).resolves.toMatchObject({
				deletedAt: expect.any(String),
			});
			await expect(listKnowledgeDocuments({ offset: 0, organizationId: organization.id })).resolves.toMatchObject(
				{
					documents: [],
				}
			);

			await expect(
				knowledge.query({
					filter: { organizationId: organization.id },
					indexName: knowledgeIndexName,
					queryVector,
					topK: 1,
				})
			).resolves.toEqual([]);
			await expect(
				listRetrievableFileIds({ fileIds: [fileId], organizationId: organization.id })
			).resolves.toEqual([]);
			await expect(
				upsertKnowledgeChunks({
					chunks: [{ chunkIndex: 0, content: "Deleted", id: vectorId }],
					fileId,
					fileName: "deleted.txt",
					organizationId: organization.id,
					source: null,
				})
			).rejects.toThrow("File is not available for indexing");
		} finally {
			await cleanupOrganizationData(organization.id);
		}
	});

	it("enforces one live file per organization and storage key", async () => {
		const organizationA = await createTestOrganization({ name: "Mastra File Url A" });
		const organizationB = await createTestOrganization({ name: "Mastra File Url B" });
		const storageKey = `${uuidv4()}.png`;

		const register = (organizationId: string) =>
			createFile({ contentType: "image/png", name: "image.png", organizationId, storageKey });

		try {
			const first = await register(organizationA.id);
			expect(first.created).toBe(true);
			await expect(register(organizationA.id)).resolves.toMatchObject({
				created: false,
				file: { id: first.file.id },
			});
			const other = await register(organizationB.id);
			expect(other.created).toBe(true);
			expect(other.file.id).not.toBe(first.file.id);
			await db.update(files).set({ deletedAt: new Date().toISOString() }).where(eq(files.id, first.file.id));
			const replacement = await register(organizationA.id);
			expect(replacement.created).toBe(true);
			expect(replacement.file.id).not.toBe(first.file.id);
		} finally {
			await Promise.all([cleanupOrganizationData(organizationA.id), cleanupOrganizationData(organizationB.id)]);
		}
	});

	it("restarts stalled Mastra ingest runs once, and fails missing, finished or abandoned ones", async () => {
		const organization = await createTestOrganization({ name: "Mastra Stale Pending Files" });
		const staleAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
		const abandonedAt = new Date(Date.now() - 40 * 60 * 1000).toISOString();
		const [noRun, activeRun, goneRun, fresh, waited, abandoned] = Array.from({ length: 6 }, () => uuidv4());

		const runStatuses = new Map([
			["run-active", { status: "running" }],
			["run-done", { status: "failed" }],
		]);

		mocks.getWorkflowRunById.mockImplementation(async (runId: string) => runStatuses.get(runId) ?? null);

		try {
			await db.insert(files).values(
				[
					{ id: noRun, updatedAt: staleAt },
					{ id: activeRun, ingestRunId: "run-active", updatedAt: staleAt },
					{ id: goneRun, ingestRunId: "run-done", updatedAt: staleAt },
					{ id: fresh },
					{ id: waited, updatedAt: staleAt },
					{ createdAt: abandonedAt, id: abandoned, ingestRunId: "run-active", updatedAt: staleAt },
				].map(({ id, ...values }) => ({
					...values,
					contentType: "text/plain",
					id,
					kind: "text" as const,
					name: `${id}.txt`,
					organizationId: organization.id,
					ragStatus: "pending" as const,
				}))
			);
			await listKnowledgeDocuments({ offset: 0, organizationId: organization.id });

			const statuses = new Map(
				(
					await db
						.select({ id: files.id, processingError: files.processingError, ragStatus: files.ragStatus })
						.from(files)
						.where(eq(files.organizationId, organization.id))
				).map(({ id, ...status }) => [id, status])
			);

			expect(statuses.get(noRun)).toEqual({ processingError: "PROCESSING_FAILED", ragStatus: "failed" });
			expect(statuses.get(activeRun)?.ragStatus).toBe("pending");
			expect(mocks.createRun).toHaveBeenCalledExactlyOnceWith({ runId: "run-active" });
			expect(mocks.restart).toHaveBeenCalledOnce();
			expect(statuses.get(goneRun)?.ragStatus).toBe("failed");
			expect(statuses.get(abandoned)?.ragStatus).toBe("failed");
			expect(statuses.get(fresh)?.ragStatus).toBe("pending");
			await listKnowledgeDocuments({ offset: 0, organizationId: organization.id });
			expect(mocks.restart).toHaveBeenCalledOnce();
			await expect(
				waitForFilesReady({ fileIds: [waited], organizationId: organization.id, timeoutMs: 5000 })
			).rejects.toThrow(`Failed to index ${waited}.txt`);
		} finally {
			await cleanupOrganizationData(organization.id);
		}
	});

	it("scopes memory and knowledge to the organization and removes them with the organization", async () => {
		const organizationA = await createTestOrganization({ name: "Mastra Organization A" });
		const organizationB = await createTestOrganization({ name: "Mastra Organization B" });
		const threadA = uuidv4();
		const threadB = uuidv4();
		const vectorA = uuidv4();
		const vectorB = uuidv4();
		const fileA = uuidv4();
		const fileB = uuidv4();
		const pendingFileA = uuidv4();
		const queryVector = unitVector(0);
		const knowledge = knowledgeVector;

		try {
			await insertReadyFile({ id: fileA, organizationId: organizationA.id });
			await insertReadyFile({ id: fileB, organizationId: organizationB.id });
			await db.insert(files).values({
				contentType: "text/plain",
				id: pendingFileA,
				kind: "text",
				name: "pending.txt",
				organizationId: organizationA.id,
				ragStatus: "pending",
			});
			expect(
				new Set(
					(await listKnowledgeDocuments({ offset: 0, organizationId: organizationA.id })).documents.map(
						({ id }) => id
					)
				)
			).toEqual(new Set([fileA, pendingFileA]));
			await createChat({ id: threadA, organizationId: organizationA.id, title: "Organization A" });
			await createChat({ id: threadB, organizationId: organizationB.id, title: "Organization B" });
			await dashboardChatMemory.saveMessages({
				messages: [
					createMessage({ organizationId: organizationA.id, text: "Private A message", threadId: threadA }),
					createMessage({ organizationId: organizationB.id, text: "Private B message", threadId: threadB }),
				],
			});

			await expect(
				dashboardChatMemory.getThreadById({ resourceId: organizationB.id, threadId: threadA })
			).resolves.toBeNull();
			await expect(getChats({ organizationId: organizationA.id })).resolves.toMatchObject({
				chats: [expect.objectContaining({ id: threadA, resourceId: organizationA.id })],
				nextPage: null,
			});

			const recalled = await dashboardChatMemory.recall({
				perPage: false,
				resourceId: organizationA.id,
				threadId: threadA,
			});

			expect(recalled.messages).toHaveLength(1);
			expect(recalled.messages[0]?.content.parts).toEqual([
				expect.objectContaining({ text: "Private A message", type: "text" }),
			]);

			await knowledge.upsert({
				ids: [vectorA, vectorB],
				indexName: knowledgeIndexName,
				metadata: [
					{ fileId: fileA, organizationId: organizationA.id },
					{ fileId: fileB, organizationId: organizationB.id },
				],
				vectors: [queryVector, unitVector(1)],
			});

			const matches = await knowledge.query({
				filter: { organizationId: organizationA.id },
				indexName: knowledgeIndexName,
				queryVector,
				topK: 2,
			});

			expect(matches.map(({ id }) => id)).toEqual([vectorA]);
			await expect(
				listRetrievableFileIds({ fileIds: [fileA, fileB, pendingFileA], organizationId: organizationA.id })
			).resolves.toEqual([fileA]);

			await deleteOrganizationAIData({ organizationId: organizationA.id });

			await expect(dashboardChatMemory.getThreadById({ threadId: threadA })).resolves.toBeNull();
			await expect(
				knowledge.query({
					filter: { organizationId: organizationA.id },
					indexName: knowledgeIndexName,
					queryVector,
					topK: 2,
				})
			).resolves.toEqual([]);
			await expect(
				dashboardChatMemory.getThreadById({ resourceId: organizationB.id, threadId: threadB })
			).resolves.not.toBeNull();
			await expect(
				knowledge.query({
					filter: { organizationId: organizationB.id },
					indexName: knowledgeIndexName,
					queryVector: unitVector(1),
					topK: 1,
				})
			).resolves.toHaveLength(1);
		} finally {
			await Promise.all([cleanupOrganizationData(organizationA.id), cleanupOrganizationData(organizationB.id)]);
		}
	});
});

const streamUsage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

const toolCallStream = ({ input, toolCallId, toolName }: { input: object; toolCallId: string; toolName: string }) => ({
	stream: simulateReadableStream({
		chunks: [
			{ type: "stream-start" as const, warnings: [] },
			{ input: JSON.stringify(input), toolCallId, toolName, type: "tool-call" as const },
			{ finishReason: "tool-calls" as const, type: "finish" as const, usage: streamUsage },
		],
	}),
});

const textStream = (text: string) => ({
	stream: simulateReadableStream({
		chunks: [
			{ type: "stream-start" as const, warnings: [] },
			{ id: "text-1", type: "text-start" as const },
			{ delta: text, id: "text-1", type: "text-delta" as const },
			{ id: "text-1", type: "text-end" as const },
			{ finishReason: "stop" as const, type: "finish" as const, usage: streamUsage },
		],
	}),
});

const createChatAgent = async (model: MastraLanguageModelV2Mock) => {
	const agent = new Agent({
		id: "chat-shape-agent",
		inputProcessors: [await createDashboardWorkingMemoryProcessor()],
		instructions: "Follow the tools.",
		memory: dashboardChatMemory,
		model,
		name: "Chat Shape Agent",
		tools: {
			askUserQuestions: assistantTools.askUserQuestions,
			publishBrand: createTool({
				description: "Publish the brand.",
				execute: async ({ revision }) => ({ revision }),
				id: "publish-brand",
				inputSchema: z.object({ revision: z.string() }),
				requireApproval: true,
			}),
		},
	});

	const runtime = new Mastra({ agents: { agent }, storage: mastraStorage });

	return runtime.getAgentById("chat-shape-agent");
};

const streamTurn = async ({
	agent,
	chatId,
	organizationId,
	text,
}: {
	agent: Awaited<ReturnType<typeof createChatAgent>>;
	chatId: string;
	organizationId: string;
	text: string;
}) => {
	const result = await agent.stream([{ content: text, role: "user" }], {
		memory: { resource: organizationId, thread: chatId },
	});

	await result.consumeStream();

	return result;
};

const startSuspendedTurn = async (turn: Parameters<typeof streamTurn>[0]) => {
	await createChat({ id: turn.chatId, organizationId: turn.organizationId });
	const result = await streamTurn(turn);

	expect(await result.finishReason).toBe("suspended");

	return (await turn.agent.listSuspendedRuns({ resourceId: turn.organizationId, threadId: turn.chatId })).runs;
};

const loadUIMessages = async ({ chatId, organizationId }: { chatId: string; organizationId: string }) =>
	convertChatMessagesForUI(await getChatMessages({ chatId, organizationId }));

describe("Mastra persisted chat shapes", () => {
	it("keeps a user message saved before streaming visible on reload and stored once", async () => {
		const organization = await createTestOrganization({ name: "Mastra Early User Message" });
		const chatId = uuidv4();
		const message = { id: uuidv4(), parts: [{ text: "Hello", type: "text" as const }], role: "user" as const };
		const agent = await createChatAgent(new MastraLanguageModelV2Mock({ doStream: textStream("Hi there.") }));

		try {
			await createChat({ id: chatId, organizationId: organization.id, title: "Early" });
			await saveChatUserMessage({ chatId, message, organizationId: organization.id });

			await expect(loadUIMessages({ chatId, organizationId: organization.id })).resolves.toMatchObject([
				{ id: message.id, parts: [{ text: "Hello", type: "text" }], role: "user" },
			]);

			const result = await agent.stream([message], { memory: { resource: organization.id, thread: chatId } });
			await result.consumeStream();

			const messages = await loadUIMessages({ chatId, organizationId: organization.id });

			expect(messages.map(({ id, role }) => ({ id, role }))).toEqual([
				{ id: message.id, role: "user" },
				{ id: expect.any(String), role: "assistant" },
			]);
		} finally {
			await cleanupOrganizationData(organization.id);
		}
	}, 20_000);

	it("keeps the approval metadata and states the chat service rewrites", async () => {
		const organization = await createTestOrganization({ name: "Mastra Approval Shapes" });
		const chatId = uuidv4();
		const toolCallId = "publish-call";

		const agent = await createChatAgent(
			new MastraLanguageModelV2Mock({
				doStream: toolCallStream({ input: { revision: "revision-1" }, toolCallId, toolName: "publishBrand" }),
			})
		);

		try {
			const runs = await startSuspendedTurn({
				agent,
				chatId,
				organizationId: organization.id,
				text: "Publish it",
			});

			expect(runs).toMatchObject([
				{ toolCalls: [expect.objectContaining({ requiresApproval: true, toolCallId })] },
			]);

			const persisted = await getChatMessages({ chatId, organizationId: organization.id });
			const pending = persisted.at(-1);

			expect(pending?.role).toBe("assistant");
			expect(pending?.content.metadata?.pendingToolApprovals).toMatchObject({
				[toolCallId]: expect.objectContaining({ toolCallId }),
			});

			const [, pendingUI] = await loadUIMessages({ chatId, organizationId: organization.id });

			expect(pendingUI?.parts.filter(isToolUIPart)).toEqual([
				expect.objectContaining({
					approval: expect.objectContaining({ id: `${runs[0]?.runId}::${toolCallId}` }),
					state: "approval-requested",
					toolCallId,
					type: "tool-publishBrand",
				}),
			]);
			expect(hasPendingAssistantRequest(pendingUI)).toBe(true);
		} finally {
			await cleanupOrganizationData(organization.id);
		}
	}, 20_000);

	it("suspends a question until its answers resume the run", async () => {
		const organization = await createTestOrganization({ name: "Mastra Question Shapes" });
		const chatId = uuidv4();
		const toolCallId = "question-call";

		const responses = [
			toolCallStream({
				input: { questions: [{ id: "plan", title: "Which plan?" }] },
				toolCallId,
				toolName: "askUserQuestions",
			}),
			textStream("Pro it is."),
		];

		const agent = await createChatAgent(
			new MastraLanguageModelV2Mock({ doStream: async () => responses.shift() ?? textStream("") })
		);

		const output = { answers: [{ question: "Which plan?", questionId: "plan", selectedOptions: ["Pro"] }] };

		try {
			const runs = await startSuspendedTurn({
				agent,
				chatId,
				organizationId: organization.id,
				text: "Set me up",
			});

			expect(runs).toMatchObject([
				{ toolCalls: [expect.objectContaining({ toolCallId, toolName: "askUserQuestions" })] },
			]);

			const [, askedUI] = await loadUIMessages({ chatId, organizationId: organization.id });

			expect(askedUI?.parts.filter(isToolUIPart)).toEqual([
				expect.objectContaining({ state: "input-available", toolCallId, type: "tool-askUserQuestions" }),
			]);
			expect(hasPendingAssistantRequest(askedUI)).toBe(true);

			const resumed = await agent.resumeStream(output, {
				memory: { resource: organization.id, thread: chatId },
				runId: runs[0]?.runId,
				toolCallId,
			});

			await resumed.consumeStream();

			const answeredUI = await loadUIMessages({ chatId, organizationId: organization.id });

			expect(answeredUI.flatMap(({ parts }) => parts.filter(isToolUIPart))).toEqual([
				expect.objectContaining({
					output,
					state: "output-available",
					toolCallId,
					type: "tool-askUserQuestions",
				}),
			]);
			expect(answeredUI.at(-1)?.parts).toContainEqual(
				expect.objectContaining({ text: "Pro it is.", type: "text" })
			);
			expect(answeredUI.some(hasPendingAssistantRequest)).toBe(false);
			await expect(
				agent.listSuspendedRuns({ resourceId: organization.id, threadId: chatId })
			).resolves.toMatchObject({ runs: [] });
		} finally {
			await cleanupOrganizationData(organization.id);
		}
	}, 20_000);

	it("delivers the organization profile read-only without persisting it into the chat history", async () => {
		const organization = await createTestOrganization({ name: "Mastra Working Memory" });
		const chatId = uuidv4();
		const model = new MastraLanguageModelV2Mock({ doStream: textStream("Hello from Acme.") });
		const agent = await createChatAgent(model);

		try {
			await createChat({ id: chatId, organizationId: organization.id, title: "Profile" });
			await dashboardChatMemory.updateWorkingMemory({
				resourceId: organization.id,
				threadId: chatId,
				workingMemory: "# Organization profile\n- **Business name**: Acme Roasters",
			});
			await streamTurn({ agent, chatId, organizationId: organization.id, text: "Who am I?" });

			const systemPrompt = JSON.stringify(
				(model.doStreamCalls[0]?.prompt ?? []).filter(({ role }) => role === "system")
			);

			expect(systemPrompt).toContain("Acme Roasters");
			expect(systemPrompt).toContain("WORKING_MEMORY_SYSTEM_INSTRUCTION (READ-ONLY)");
			expect(systemPrompt).not.toContain("updateWorkingMemory");

			const uiMessages = await loadUIMessages({ chatId, organizationId: organization.id });

			expect(uiMessages.map(({ role }) => role)).toEqual(["user", "assistant"]);
			expect(uiMessages.flatMap(({ parts }) => parts.map(({ type }) => type))).toEqual(["text", "text"]);
			expect(JSON.stringify(uiMessages)).not.toContain("Acme Roasters");
			expect(hasPendingAssistantRequest(uiMessages.at(-1))).toBe(false);
		} finally {
			await cleanupOrganizationData(organization.id);
		}
	}, 20_000);
});
