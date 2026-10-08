"use client";

import { useEffect, useRef } from "react";

import { type UseChatHelpers } from "@ai-sdk/react";
import { type DataUIPart } from "ai";
import {
	lastAssistantMessageIsCompleteWithApprovalResponses,
	lastAssistantMessageIsCompleteWithToolCalls,
	validateUIMessages,
} from "ai";

import type { BaseCustomUIDataTypes, DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";

export type UseAutoResumeParams = {
	autoResume: boolean;
	data: Array<DataUIPart<BaseCustomUIDataTypes>>;
	initialMessages: Array<BaseChatUIMessage>;
	resumeStream: UseChatHelpers<BaseChatUIMessage>["resumeStream"];
	setMessages: UseChatHelpers<BaseChatUIMessage>["setMessages"];
};

export const useAutoResume = ({
	autoResume,
	data,
	initialMessages,
	resumeStream,
	setMessages,
}: UseAutoResumeParams) => {
	const hasAttemptedResumeRef = useRef(false);

	useEffect(() => {
		if (!autoResume || hasAttemptedResumeRef.current) {
			return;
		}

		hasAttemptedResumeRef.current = true;

		const mostRecentMessage = initialMessages.at(-1);

		const shouldResumeAssistantContinuation =
			mostRecentMessage?.role === "assistant" &&
			(lastAssistantMessageIsCompleteWithToolCalls({ messages: [mostRecentMessage] }) ||
				lastAssistantMessageIsCompleteWithApprovalResponses({ messages: [mostRecentMessage] }));

		if (mostRecentMessage?.role === "user" || shouldResumeAssistantContinuation) {
			resumeStream();
		}

		// oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!data || data.length === 0) {
			return;
		}

		const dataPart = data[0];

		if (dataPart.type === "data-append-message") {
			(async () => {
				try {
					const [message] = await validateUIMessages<BaseChatUIMessage>({
						messages: [JSON.parse(dataPart.data)],
					});

					if (!message) {
						return;
					}

					setMessages((currentMessages) => {
						if (currentMessages.some((currentMessage) => currentMessage.id === message.id)) {
							return currentMessages;
						}

						return [...currentMessages, message];
					});
				} catch {}
			})();
		}
	}, [data, setMessages]);
};
