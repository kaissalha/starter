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
import { z } from "zod";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { client } from "@/lib/api-client";
import type { DashboardChatUIMessage as BaseChatUIMessage, DashboardChatTools } from "@starter/server";

const serverErrorSchema = z.compile(z.object({ error: z.object({ message: z.string() }) }));

const knownErrors = [
	["Assistant continuation does not match", "continuationMismatch"],
	["Resolve the pending assistant request", "continuationMismatch"],
	["This approval is no longer pending", "approvalExpired"],
] as const;

const extractErrorMessage = (rawMessage: string) => {
	if (!rawMessage.trimStart().startsWith("{")) {
		return rawMessage;
	}

	try {
		// oxlint-disable-next-line unicorn(prefer-structured-clone)
		return serverErrorSchema.safeParse(JSON.parse(rawMessage)).data?.error.message;
	} catch {
		return undefined;
	}
};

const classifyChatError = (
	rawMessage: string
): { key: "approvalExpired" | "continuationMismatch" | "generic" } | { message: string } => {
	const message = extractErrorMessage(rawMessage);
	const known = knownErrors.find(([prefix]) => message?.startsWith(prefix));

	if (known) {
		return { key: known[1] };
	}

	return message ? { message } : { key: "generic" };
};

export type ChatSessionConfig = {
	chatId: string;
	onChatCreated?: (chatId: string) => void;
};

type ChatSession = ReturnType<typeof createChatSession>;

type ChatPart = BaseChatUIMessage["parts"][number];

export type ChatSessionState = {
	actions: ChatSession["actions"];
	error: Error | undefined;
	isLoading: boolean;
	messages: Array<BaseChatUIMessage>;
	status: ChatStatus;
};

type PendingSend = { reject: (error: Error) => void; resolve: () => void };

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
		onFinish: ({ isAbort, isError }) => {
			if (isError) {
				settleSend(new Error("Chat request failed."));
			} else if (isAbort) {
				settleSend(new Error("Chat request was cancelled."));
			} else {
				settleSend();
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
				body: { ...body, message: messages.at(-1) },
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

export const isPendingApprovalPart = (part: ChatPart): part is Extract<ChatPart, { state: "approval-requested" }> =>
	isToolUIPart(part) && part.state === "approval-requested" && !part.approval.isAutomatic;

export const isAwaitingApproval = (messages: Array<BaseChatUIMessage>) =>
	messages.some((message) => message.parts.some(isPendingApprovalPart));

export const isChatSessionBusy = ({ isLoading, messages }: Pick<ChatSessionState, "isLoading" | "messages">) =>
	isLoading ||
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

export const useChatSession = (): ChatSessionState => {
	const session = useContext(ChatSessionContext);

	if (session == null) {
		throw new Error("useChatSession must be used within ChatSessionProvider");
	}

	const { actions, chat } = session;
	const { error, messages, status } = useChat({ chat, throttle: 100 });
	const t = useTranslations("components.chat.errors");
	const classified = error ? classifyChatError(error.message) : undefined;

	return {
		actions,
		error: classified && new Error("key" in classified ? t(classified.key) : classified.message),
		isLoading: status === "streaming" || status === "submitted",
		messages,
		status,
	};
};
