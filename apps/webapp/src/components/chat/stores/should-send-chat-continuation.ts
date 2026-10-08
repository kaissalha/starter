import {
	isToolUIPart,
	lastAssistantMessageIsCompleteWithApprovalResponses,
	lastAssistantMessageIsCompleteWithToolCalls,
	type UIMessage,
} from "ai";

export const shouldSendChatContinuation = ({ messages }: { messages: Array<UIMessage> }) => {
	if (lastAssistantMessageIsCompleteWithApprovalResponses({ messages })) {
		return true;
	}

	if (!lastAssistantMessageIsCompleteWithToolCalls({ messages })) {
		return false;
	}

	const message = messages.at(-1);

	if (message?.role !== "assistant") {
		return false;
	}

	const lastStepStartIndex = message.parts.findLastIndex((part) => part.type === "step-start");

	return message.parts
		.slice(lastStepStartIndex + 1)
		.some(
			(part) => isToolUIPart(part) && part.type === "tool-askUserQuestions" && part.state === "output-available"
		);
};
