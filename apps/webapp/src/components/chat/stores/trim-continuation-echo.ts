import { isToolUIPart } from "ai";

import type { DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";

type ChatMessagePart = BaseChatUIMessage["parts"][number];

const partsEqual = ({ a, b }: { a: ChatMessagePart; b: ChatMessagePart | undefined }) =>
	JSON.stringify(a) === JSON.stringify(b);

const resolvedContinuationToolCallIds = (message: BaseChatUIMessage) =>
	message.parts.flatMap((part) =>
		isToolUIPart(part) &&
		(part.state === "approval-responded" ||
			(part.type === "tool-askUserQuestions" && part.state === "output-available"))
			? [part.toolCallId]
			: []
	);

const resumesMessage = ({ last, previous }: { last: BaseChatUIMessage; previous: BaseChatUIMessage }) => {
	const resumedToolCallIds = new Set(last.parts.flatMap((part) => (isToolUIPart(part) ? [part.toolCallId] : [])));

	return resolvedContinuationToolCallIds(previous).some((toolCallId) => resumedToolCallIds.has(toolCallId));
};

export const trimContinuationEcho = (messages: Array<BaseChatUIMessage>): Array<BaseChatUIMessage> => {
	const last = messages.at(-1);
	const previous = messages.at(-2);

	if (!last || !previous || last.role !== "assistant" || previous.role !== "assistant") {
		return messages;
	}

	if (previous.parts.length === 0) {
		return messages;
	}

	const isEcho =
		last.parts.length >= previous.parts.length &&
		previous.parts.every((part, index) => partsEqual({ a: part, b: last.parts[index] }));

	if (isEcho && last.parts.length === previous.parts.length) {
		return messages.slice(0, -1);
	}

	if (isEcho || resumesMessage({ last, previous })) {
		return [...messages.slice(0, -2), { ...last, id: previous.id }];
	}

	return messages;
};
