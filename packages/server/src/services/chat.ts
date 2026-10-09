import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { MessageList, type MastraDBMessage } from "@mastra/core/agent";
import { validateUIMessages } from "ai";

import { pool } from "@starter/db";
import { log, serializeLogError } from "@starter/observability";

import type { DashboardChatUIMessage } from "../ai/types";
import { dashboardChatMemory } from "../mastra/memory";

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
	metadata,
	organizationId,
	title,
}: {
	id: string;
	metadata?: Record<string, string>;
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
			metadata,
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

type ChatPage = {
	chats: Awaited<ReturnType<typeof dashboardChatMemory.listThreads>>["threads"];
	nextPage: number | null;
};

export const getChats = async ({
	organizationId,
	page = 0,
}: {
	organizationId: string;
	page?: number;
}): Promise<ChatPage> => {
	const result = await dashboardChatMemory.listThreads({
		filter: { resourceId: organizationId },
		orderBy: { direction: "DESC", field: "updatedAt" },
		page,
		perPage: CHAT_PAGE_SIZE,
	});

	const chats = result.threads.filter((thread) => !thread.metadata?.libraryChat);
	const nextPage = result.hasMore ? page + 1 : null;

	return chats.length === 0 && nextPage !== null ? getChats({ organizationId, page: nextPage }) : { chats, nextPage };
};

export const findLatestChat = async ({
	metadata,
	organizationId,
}: {
	metadata: Record<string, string>;
	organizationId: string;
}) => {
	const result = await dashboardChatMemory.listThreads({
		filter: { metadata, resourceId: organizationId },
		orderBy: { direction: "DESC", field: "updatedAt" },
		page: 0,
		perPage: 1,
	});

	return result.threads[0] ?? null;
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
