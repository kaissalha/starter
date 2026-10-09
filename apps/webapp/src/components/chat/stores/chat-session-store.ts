"use client";

import { createContext, createElement, type ReactNode, useContext, useEffect, useState } from "react";

import { Chat, useChat } from "@ai-sdk/react";
import {
	type ChatStatus,
	DefaultChatTransport,
	isToolUIPart,
	lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useTranslations } from "next-intl";
import { v4 as uuidv4 } from "uuid";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { client } from "@/lib/api-client";
import type { DashboardChatUIMessage as BaseChatUIMessage, DashboardChatTools } from "@starter/server";

import { classifyChatError } from "./chat-error-message";
import { chatToolDataChanges, type ChatDataDomain } from "./chat-tool-data-changes";

export type ChatSessionConfig = {
	chatId: string;
	library?: { assetId?: string };
	onChatCreated?: (chatId: string) => void;
	onDataChange?: Partial<Record<ChatDataDomain, () => void>>;
};

type ChatSession = ReturnType<typeof createChatSession>;

export type ChatRuntimeActions = ChatSession["actions"];

export type ChatSessionState = {
	actions: ChatRuntimeActions | undefined;
	error: Error | undefined;
	messages: Array<BaseChatUIMessage>;
	status: ChatStatus;
};

type PendingSend = { reject: (error: Error) => void; resolve: () => void };

const listCompletedToolCalls = (messages: Array<BaseChatUIMessage>) =>
	messages.flatMap(({ parts }) =>
		parts.flatMap((part) =>
			isToolUIPart(part) && part.state === "output-available"
				? [{ toolCallId: part.toolCallId, toolName: part.type.slice("tool-".length) }]
				: []
		)
	);

type ChatSessionSettings = { canWrite: boolean; config: ChatSessionConfig };

type PendingSendReference = { value?: PendingSend };

const createChatSession = ({
	initialMessages,
	settings,
}: {
	initialMessages: Array<BaseChatUIMessage>;
	settings: ChatSessionSettings;
}) => {
	const { chatId } = settings.config;
	const current = { ...settings };
	const reportedToolCallIds = new Set(listCompletedToolCalls(initialMessages).map(({ toolCallId }) => toolCallId));
	const chatCreated = { value: initialMessages.length > 0 };
	const pendingSend: PendingSendReference = {};

	const settleSend = (error?: Error) => {
		const pending = pendingSend.value;
		pendingSend.value = undefined;

		if (error) {
			pending?.reject(error);
		} else {
			pending?.resolve();
		}
	};

	const chat: Chat<BaseChatUIMessage> = new Chat<BaseChatUIMessage>({
		generateId: () => uuidv4(),
		id: chatId,
		messages: initialMessages,
		onError: async (error) => {
			settleSend(error);

			if (lastAssistantMessageIsCompleteWithApprovalResponses({ messages: chat.messages })) {
				try {
					chat.messages = await client.chats.messages({ chatId });
				} catch {}
			}
		},
		onFinish: ({ isAbort, isError, messages }) => {
			if (isError) {
				settleSend(new Error("Chat request failed."));
			} else if (isAbort) {
				settleSend(new Error("Chat request was cancelled."));
			} else {
				settleSend();
			}

			const domains = new Set(
				listCompletedToolCalls(messages).flatMap(({ toolCallId, toolName }) => {
					if (reportedToolCallIds.has(toolCallId)) {
						return [];
					}

					reportedToolCallIds.add(toolCallId);

					return chatToolDataChanges.get(toolName) ?? [];
				})
			);

			for (const domain of domains) {
				current.config.onDataChange?.[domain]?.();
			}
		},
		sendAutomaticallyWhen: (options) =>
			current.canWrite && lastAssistantMessageIsCompleteWithApprovalResponses(options),
		transport: new DefaultChatTransport({
			credentials: "include",
			fetch: async (input, init) => {
				const response = await fetch(input, init);

				if (init?.method === "POST" && response.ok) {
					settleSend();

					if (!chatCreated.value) {
						chatCreated.value = true;
						current.config.onChatCreated?.(chatId);
					}
				}

				return response;
			},
			prepareReconnectToStreamRequest: ({ id }) => ({ api: `/api/chats/${id}/stream` }),
			prepareSendMessagesRequest: ({ body, id, messages }) => ({
				api: `/api/chats/${id}/stream`,
				body: { ...body, library: current.config.library, message: messages.at(-1) },
			}),
		}),
	});

	const sendMessage = (...args: Parameters<typeof chat.sendMessage>) => {
		if (pendingSend.value) {
			return Promise.reject(new Error("A chat message is already being sent."));
		}

		const accepted = new Promise<void>((resolve, reject) => {
			pendingSend.value = { reject, resolve };
		});

		(async () => {
			try {
				await chat.sendMessage(...args);
			} catch (error) {
				settleSend(error instanceof Error ? error : new Error("Chat request failed."));
			}
		})();

		return accepted;
	};

	const answerQuestions = async ({
		output,
		toolCallId,
	}: {
		output: DashboardChatTools["askUserQuestions"]["output"];
		toolCallId: string;
	}) => {
		await chat.addToolOutput({ output, tool: "askUserQuestions", toolCallId });

		return sendMessage(undefined, { body: { resume: { data: output, toolCallId } } });
	};

	const stop = async () => {
		try {
			await client.chats.cancelStream({ chatId });
		} catch {}

		await chat.stop();
	};

	return {
		actions: { addToolApprovalResponse: chat.addToolApprovalResponse, answerQuestions, sendMessage, stop },
		chat,
		configure: (next: ChatSessionSettings) => {
			Object.assign(current, next);
		},
	};
};

export const selectChatSessionAwaitingApproval = ({ messages }: ChatSessionState) =>
	messages.some((message) =>
		message.parts.some(
			(part) => isToolUIPart(part) && part.state === "approval-requested" && !part.approval.isAutomatic
		)
	);

export const selectChatSessionBusy = ({ messages, status }: ChatSessionState) =>
	status === "streaming" ||
	status === "submitted" ||
	messages.some((message) =>
		message.parts.some(
			(part) =>
				isToolUIPart(part) &&
				(part.state === "approval-requested" ||
					(part.type === "tool-askUserQuestions" && part.state === "input-available"))
		)
	);

const ChatSessionContext = createContext<ChatSession | null>(null);

const EMPTY_MESSAGES: Array<BaseChatUIMessage> = [];

export const ChatSessionProvider = ({
	children,
	initialMessages = EMPTY_MESSAGES,
	runtime,
}: {
	children: ReactNode;
	initialMessages?: Array<BaseChatUIMessage>;
	runtime: ChatSessionConfig;
}) => {
	const { can } = useOrganizationPermissions();
	const canWrite = can("workspace.write");

	const [session, setSession] = useState(() =>
		createChatSession({ initialMessages, settings: { canWrite, config: runtime } })
	);

	if (session.chat.id !== runtime.chatId) {
		setSession(createChatSession({ initialMessages, settings: { canWrite, config: runtime } }));
	}

	useEffect(() => {
		session.configure({ canWrite, config: runtime });
	}, [session, canWrite, runtime]);

	useChat({ chat: session.chat, resume: true });

	useEffect(
		() => () => {
			session.chat.stop();
		},
		[session]
	);

	return createElement(ChatSessionContext.Provider, { value: session }, children);
};

const useChatSessionContext = () => {
	const session = useContext(ChatSessionContext);

	if (session == null) {
		throw new Error("useChatSession must be used within ChatSessionProvider");
	}

	return session;
};

export const useChatSession = <T>(selector: (state: ChatSessionState) => T): T => {
	const { actions, chat } = useChatSessionContext();
	const { error, messages, status } = useChat({ chat, throttle: 100 });
	const t = useTranslations("components.chat.errors");
	const classified = error ? classifyChatError(error.message) : undefined;

	return selector({
		actions,
		error: classified && new Error("key" in classified ? t(classified.key) : classified.message),
		messages,
		status,
	});
};

export const useChatMessageIds = () => useChatSession(({ messages }) => messages.map(({ id }) => id));

export const useChatMessage = (messageId: string) =>
	useChatSession(({ messages }) => messages.find(({ id }) => id === messageId));
