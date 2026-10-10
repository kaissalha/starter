import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { MessageList, type MastraDBMessage } from "@mastra/core/agent";
import { validateUIMessages } from "ai";

import { createLock } from "@starter/cache";
import { pool } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";

import { dashboardChatMemory } from "../ai/memory";
import type { DashboardChatUIMessage } from "../ai/types";
import { getStreamRedis } from "../lib/redis";

const CHAT_PAGE_SIZE = 20;

export class ChatOwnershipConflictError extends Error {
	constructor() {
		super("Chat id is already owned by another organization");
		this.name = "ChatOwnershipConflictError";
	}
}

const getThreadOwner = async (id: string) => (await dashboardChatMemory.getThreadById({ threadId: id }))?.resourceId;

export const createChat = async ({
	id,
	organizationId,
	title,
}: {
	id: string;
	organizationId: string;
	title?: string;
}) => {
	const client = await pool.connect();

	try {
		await client.query("BEGIN");
		await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [id]);

		const existing = await dashboardChatMemory.getThreadById({ threadId: id });

		if (existing) {
			if (existing.resourceId !== organizationId) {
				throw new ChatOwnershipConflictError();
			}

			await client.query("COMMIT");

			return existing;
		}

		const thread = await dashboardChatMemory.createThread({
			resourceId: organizationId,
			threadId: id,
			title,
		});

		if ((await getThreadOwner(id)) !== organizationId) {
			throw new ChatOwnershipConflictError();
		}

		await client.query("COMMIT");

		return thread;
	} catch (error) {
		try {
			await client.query("ROLLBACK");
		} catch (rollbackError) {
			await log.warn({ error: serializeLogError(rollbackError), message: "Chat creation rollback failed" });
		}

		throw error;
	} finally {
		client.release();
	}
};

export const saveChatUserMessage = async ({
	chatId,
	message,
	organizationId,
}: {
	chatId: string;
	message: DashboardChatUIMessage;
	organizationId: string;
}) => {
	await dashboardChatMemory.saveMessages({
		messages: new MessageList({ resourceId: organizationId, threadId: chatId }).add(message, "input").get.all.db(),
	});
};

export const chatMessageIdExists = async (id: string) => {
	const memoryStore = await dashboardChatMemory.storage.getStore("memory");

	if (!memoryStore) {
		throw new Error("Mastra memory storage is not configured");
	}

	const { messages } = await memoryStore.listMessagesById({ messageIds: [id] });

	return messages.length > 0;
};

export const convertChatMessagesForUI = async (messages: Array<MastraDBMessage>) => {
	if (messages.length === 0) {
		return [];
	}

	const createdAtById = new Map(messages.map(({ createdAt, id }) => [id, createdAt]));

	const converted = toAISdkMessages(messages, { version: "v7" }).map(({ metadata: _metadata, ...message }) => ({
		...message,
		metadata: { createdAt: createdAtById.get(message.id)?.toISOString() },
	}));

	if (converted.length === 0) {
		return [];
	}

	return validateUIMessages<DashboardChatUIMessage>({ messages: converted });
};

export const getChat = async (id: string, organizationId: string) =>
	dashboardChatMemory.getThreadById({ resourceId: organizationId, threadId: id });

export const getChats = async ({ organizationId, page = 0 }: { organizationId: string; page?: number }) => {
	const result = await dashboardChatMemory.listThreads({
		filter: { resourceId: organizationId },
		orderBy: { direction: "DESC", field: "updatedAt" },
		page,
		perPage: CHAT_PAGE_SIZE,
	});

	return { chats: result.threads, nextPage: result.hasMore ? page + 1 : null };
};

export const getChatWithMessages = async ({
	chatId,
	limit,
	organizationId,
}: {
	chatId: string;
	limit?: number;
	organizationId: string;
}) => {
	const chat = await dashboardChatMemory.getThreadById({ resourceId: organizationId, threadId: chatId });

	if (!chat) {
		return null;
	}

	const { messages } = await dashboardChatMemory.recall({
		perPage: limit ?? false,
		resourceId: organizationId,
		threadId: chatId,
	});

	return { ...chat, messages };
};

export const getChatMessages = async ({ chatId, organizationId }: { chatId: string; organizationId: string }) =>
	(await getChatWithMessages({ chatId, organizationId }))?.messages ?? [];

type ChatScope = { chatId: string; organizationId: string };

const activeStreamKey = ({ chatId, organizationId }: ChatScope) => `chat-stream:${organizationId}:${chatId}`;

export const setActiveChatStream = async ({ streamId, ...chat }: ChatScope & { streamId: string }) => {
	await getStreamRedis().set(activeStreamKey(chat), streamId, "EX", 86_400);
};

export const getActiveChatStream = (chat: ChatScope) => getStreamRedis().get(activeStreamKey(chat));

export const clearActiveChatStream = ({ streamId, ...chat }: ChatScope & { streamId: string }) =>
	createLock({ id: activeStreamKey(chat), lease: "1 d", redis: getStreamRedis(), token: streamId }).release();

export const cancelChatStream = async (chat: ChatScope) => {
	if (process.env.REDIS_URL) {
		await getStreamRedis().del(activeStreamKey(chat));
	}
};
