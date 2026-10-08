"use client";

import { createContext, createElement, type ReactNode, useContext, useState } from "react";

import type { UseChatHelpers } from "@ai-sdk/react";
import { isToolUIPart, type ChatStatus } from "ai";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";

import { ChatSessionRuntime, type ChatSessionRuntimeConfig } from "./chat-session-runtime";

export type ChatRuntimeActions = Pick<
	UseChatHelpers<BaseChatUIMessage>,
	"sendMessage" | "regenerate" | "resumeStream" | "setMessages" | "addToolOutput" | "addToolApprovalResponse"
> & {
	stop: () => void | Promise<void>;
};

export type ChatSessionState = {
	actions: ChatRuntimeActions | undefined;
	error: Error | undefined;
	messages: Array<BaseChatUIMessage>;
	status: ChatStatus;
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

const ChatSessionStoreContext = createContext<StoreApi<ChatSessionState> | null>(null);

type ChatSessionProviderProps = {
	children: ReactNode;
	initialMessages?: Array<BaseChatUIMessage>;
	runtime: ChatSessionRuntimeConfig;
};

const EMPTY_MESSAGES: Array<BaseChatUIMessage> = [];

export const ChatSessionProvider = ({
	children,
	initialMessages = EMPTY_MESSAGES,
	runtime,
}: ChatSessionProviderProps) => {
	const [store] = useState(() =>
		createStore<ChatSessionState>()(() => ({
			actions: undefined,
			error: undefined,
			messages: initialMessages,
			status: "ready",
		}))
	);

	return createElement(
		ChatSessionStoreContext.Provider,
		{ value: store },
		createElement(ChatSessionRuntime, { ...runtime, initialMessages, store }),
		children
	);
};

export const useChatSessionStoreApi = () => {
	const store = useContext(ChatSessionStoreContext);

	if (store == null) {
		throw new Error("useChatSessionStoreApi must be used within ChatSessionProvider");
	}

	return store;
};

export const useChatSession = <T>(selector: (state: ChatSessionState) => T): T => {
	const store = useChatSessionStoreApi();

	return useStore(store, useShallow(selector));
};

export const useChatMessageIds = () => {
	const store = useChatSessionStoreApi();

	return useStore(
		store,
		useShallow((state) => state.messages.map((message) => message.id))
	);
};

export const useChatMessage = (messageId: string) => {
	const store = useChatSessionStoreApi();

	return useStore(store, (state) => state.messages.find((message) => message.id === messageId));
};
