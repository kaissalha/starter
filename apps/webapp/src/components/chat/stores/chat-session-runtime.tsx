"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from "react";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { useTranslations } from "next-intl";
import { v4 as uuidv4 } from "uuid";
import type { StoreApi } from "zustand/vanilla";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { client } from "@/lib/api-client";
import type { DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";

import { classifyChatError } from "./chat-error-message";
import type { ChatSessionState } from "./chat-session-store";
import { chatToolDataChanges, type ChatDataDomain } from "./chat-tool-data-changes";
import { shouldSendChatContinuation } from "./should-send-chat-continuation";
import { trimContinuationEcho } from "./trim-continuation-echo";

export type ChatSessionRuntimeConfig = {
	chatId: string;
	library?: { assetId?: string };
	onChatCreated?: (chatId: string) => void;
	onDataChange?: Partial<Record<ChatDataDomain, () => void>>;
};

type ChatSessionRuntimeProps = ChatSessionRuntimeConfig & {
	initialMessages: Array<BaseChatUIMessage>;
	store: StoreApi<ChatSessionState>;
};

type PendingSend = {
	reject: (error: Error) => void;
	resolve: () => void;
};

const listCompletedToolResults = ({ messages }: { messages: Array<BaseChatUIMessage> }) =>
	messages.flatMap((message) =>
		message.parts.flatMap((part) => {
			if (!isToolUIPart(part) || part.state !== "output-available") {
				return [];
			}

			return [{ toolCallId: part.toolCallId, toolName: part.type.slice("tool-".length) }];
		})
	);

export const ChatSessionRuntime = ({
	chatId,
	initialMessages,
	library,
	onChatCreated,
	onDataChange,
	store,
}: ChatSessionRuntimeProps) => {
	const pendingSend = useRef<PendingSend | undefined>(undefined);

	const reportedToolCallIds = useRef(
		new Set(listCompletedToolResults({ messages: initialMessages }).map(({ toolCallId }) => toolCallId))
	);

	const reportedChatCreated = useRef(initialMessages.length > 0);

	const reportDataChanges = useEffectEvent((domains: Set<ChatDataDomain>) => {
		for (const domain of domains) {
			onDataChange?.[domain]?.();
		}
	});

	const resolvePendingSend = useCallback(() => {
		const currentPendingSend = pendingSend.current;

		if (!currentPendingSend) {
			return;
		}

		pendingSend.current = undefined;
		currentPendingSend.resolve();
	}, []);

	const rejectPendingSend = useCallback((error: Error) => {
		const currentPendingSend = pendingSend.current;

		if (!currentPendingSend) {
			return;
		}

		pendingSend.current = undefined;
		currentPendingSend.reject(error);
	}, []);

	const t = useTranslations("components.chat.errors");
	const { can } = useOrganizationPermissions();

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				credentials: "include",
				prepareReconnectToStreamRequest: ({ id }) => ({ api: `/api/chats/${id}/stream` }),
				prepareSendMessagesRequest: ({ id, messages }) => ({
					api: `/api/chats/${id}/stream`,
					body: { library, message: messages.at(-1) },
				}),
			}),
		[library]
	);

	const {
		addToolApprovalResponse,
		addToolOutput,
		error,
		messages,
		regenerate,
		resumeStream,
		sendMessage,
		setMessages,
		status,
		stop,
	} = useChat<BaseChatUIMessage>({
		experimental_throttle: 100,
		generateId: () => uuidv4(),
		id: chatId,
		messages: initialMessages,

		onError: rejectPendingSend,

		onFinish: ({ isAbort, isError, messages: finishedMessages }) => {
			const trimmed = trimContinuationEcho(finishedMessages);

			if (trimmed !== finishedMessages) {
				setMessages(trimmed);
			}

			if (isError) {
				rejectPendingSend(new Error("Chat request failed."));

				return;
			}

			if (isAbort) {
				rejectPendingSend(new Error("Chat request was cancelled."));

				return;
			}

			resolvePendingSend();
		},

		resume: true,
		sendAutomaticallyWhen: (options) => can("workspace.write") && shouldSendChatContinuation(options),
		transport,
	});

	const sendMessageWithError = useCallback(
		(...args: Parameters<typeof sendMessage>) => {
			if (pendingSend.current) {
				return Promise.reject(new Error("A chat message is already being sent."));
			}

			const accepted = new Promise<void>((resolve, reject) => {
				pendingSend.current = { reject, resolve };
			});

			(async () => {
				try {
					await sendMessage(...args);
					resolvePendingSend();
				} catch (error) {
					rejectPendingSend(error instanceof Error ? error : new Error("Chat request failed."));
				}
			})();

			return accepted;
		},
		[rejectPendingSend, resolvePendingSend, sendMessage]
	);

	const stopStream = useCallback(async () => {
		try {
			await client.chats.cancelStream({ chatId });
		} catch {}

		stop();
	}, [chatId, stop]);

	const resyncAfterFailedContinuation = useEffectEvent(async () => {
		if (!shouldSendChatContinuation({ messages })) {
			return;
		}

		try {
			setMessages(await client.chats.messages({ chatId }));
		} catch {}
	});

	useEffect(() => {
		if (error) {
			resyncAfterFailedContinuation();
		}
	}, [error]);

	const displayError = useMemo(() => {
		if (!error) {
			return undefined;
		}

		const classified = classifyChatError(error.message);

		return new Error("key" in classified ? t(classified.key) : classified.message);
	}, [error, t]);

	useEffect(() => {
		store.setState({ error: displayError, messages: trimContinuationEcho(messages), status });
	}, [store, messages, status, displayError]);

	const reportChatCreated = useEffectEvent(() => {
		if (!reportedChatCreated.current) {
			reportedChatCreated.current = true;
			onChatCreated?.(chatId);
		}
	});

	useEffect(() => {
		if (status === "streaming") {
			resolvePendingSend();
			reportChatCreated();
		}
	}, [resolvePendingSend, status]);

	useEffect(() => {
		const domains = new Set<ChatDataDomain>();
		listCompletedToolResults({ messages }).forEach(({ toolCallId, toolName }) => {
			if (reportedToolCallIds.current.has(toolCallId)) {
				return;
			}

			reportedToolCallIds.current.add(toolCallId);

			for (const domain of chatToolDataChanges.get(toolName) ?? []) {
				domains.add(domain);
			}
		});
		reportDataChanges(domains);
	}, [messages]);

	useEffect(() => {
		store.setState({
			actions: {
				addToolApprovalResponse,
				addToolOutput,
				regenerate,
				resumeStream,
				sendMessage: sendMessageWithError,
				setMessages,
				stop: stopStream,
			},
		});
	}, [
		store,
		sendMessageWithError,
		regenerate,
		resumeStream,
		setMessages,
		addToolOutput,
		addToolApprovalResponse,
		stopStream,
	]);

	return null;
};
