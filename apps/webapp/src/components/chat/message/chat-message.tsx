"use client";

import { Tick02Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { isToolUIPart } from "ai";
import { MorphIcon } from "morphicons/react";
import { useTranslations } from "next-intl";

import { useChatMessage } from "@/components/chat/stores/chat-session-store";
import type { DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";
import { Button } from "@starter/ui/components/button";
import { useCopyToClipboard } from "@starter/ui/hooks/use-copy-to-clipboard";
import { cn } from "@starter/ui/lib/utils";

import { ChatMessageParts, type ChatMessagePart, type ChatMessagePartType } from "./chat-message-parts";
import { getVisibleMessageParts } from "./get-visible-message-parts";
import { askUserQuestionsOutputSchema } from "./parts/ask-user-questions-schema";

type MessageRenderData = {
	hasNonEmptyText: boolean;
	hasVisibleAssistantContent: boolean;
	textContent: string;
};

const isVisibleAssistantPartType = (partType: ChatMessagePartType) =>
	partType === "text" ||
	partType === "source-url" ||
	partType === "file" ||
	partType === "data-error" ||
	partType.startsWith("tool-");

const buildMessageRenderData = (message: BaseChatUIMessage): MessageRenderData => {
	const textContent = getVisibleMessageParts({ isUser: message.role === "user", parts: message.parts })
		.filter((part): part is Extract<ChatMessagePart, { type: "text" }> => part.type === "text")
		.map((part) => part.text)
		.join("\n");

	return {
		hasNonEmptyText: textContent.trim() !== "",
		hasVisibleAssistantContent: message.parts.some((part) => isVisibleAssistantPartType(part.type)),
		textContent,
	};
};

const shouldShowThinkingIndicator = ({
	isStreaming,
	message,
}: {
	isStreaming: boolean;
	message: BaseChatUIMessage;
}) => {
	if (!isStreaming || message.role !== "assistant") {
		return false;
	}

	const lastPart = message.parts.at(-1);

	if (!lastPart) {
		return true;
	}

	if (lastPart.type === "text") {
		return !lastPart.text.trim();
	}

	if (lastPart.type === "reasoning") {
		return true;
	}

	if (
		["tool-skill", "tool-skill_read", "tool-skill_search"].includes(lastPart.type) ||
		(lastPart.type === "dynamic-tool" && ["skill", "skill_read", "skill_search"].includes(lastPart.toolName))
	) {
		return true;
	}

	if (isToolUIPart(lastPart)) {
		return lastPart.state === "output-available" || lastPart.state === "output-error";
	}

	return true;
};

const MessageContainer = ({
	children,
	className,
	isUser,
}: {
	children: React.ReactNode;
	className?: string;
	isUser: boolean;
}) => (
	<div
		className={cn(
			"group/message flex w-full max-w-full flex-col gap-3 overflow-hidden py-5",
			isUser ? "items-end" : "items-start",
			className
		)}
	>
		{children}
	</div>
);

const AssistantMessageActions = ({ copyableText }: { copyableText: string }) => {
	const t = useTranslations("components.chat.message");
	const { copyToClipboard, isCopied } = useCopyToClipboard();

	return (
		<div className='flex items-center gap-2 px-1 transition-opacity group-hover/message:opacity-100 has-focus-visible:opacity-100 [@media(hover:hover)]:opacity-0'>
			<Button
				aria-label={isCopied ? t("copiedToClipboard") : t("copyToClipboard")}
				onClick={() => copyToClipboard(copyableText)}
				size='icon'
				title={isCopied ? t("copiedToClipboard") : t("copyToClipboard")}
				variant={isCopied ? "secondary" : "ghost"}
			>
				<MorphIcon
					className='scale-110'
					icon={isCopied ? Tick02Icon : Copy01Icon}
					reducedMotion='user'
					strokeWidth={1.75}
				/>
			</Button>
		</div>
	);
};

const MessageBody = ({
	className,
	isStreaming = false,
	message,
}: {
	className?: string;
	isStreaming?: boolean;
	message: BaseChatUIMessage;
}) => {
	const isUser = message.role === "user";
	const renderData = buildMessageRenderData(message);
	const showThinkingIndicator = shouldShowThinkingIndicator({ isStreaming, message });

	const hasAnsweredQuestions = message.parts.some((part) => {
		if (part.type !== "tool-askUserQuestions" || part.state !== "output-available") {
			return false;
		}

		const output = askUserQuestionsOutputSchema.safeParse(part.output);

		return output.success && Boolean(output.data.answers?.length);
	});

	const showCopyAction =
		!isStreaming && message.role === "assistant" && renderData.hasNonEmptyText && !hasAnsweredQuestions;

	return (
		<MessageContainer className={className} isUser={isUser}>
			<ChatMessageParts
				isStreaming={isStreaming}
				isUser={isUser}
				messageId={message.id}
				parts={message.parts}
				showThinking={showThinkingIndicator}
			/>
			{showCopyAction ? <AssistantMessageActions copyableText={renderData.textContent} /> : null}
		</MessageContainer>
	);
};

export const ChatMessageById = ({
	className,
	isStreaming = false,
	messageId,
}: {
	className?: string;
	isStreaming?: boolean;
	messageId: string;
}) => {
	const message = useChatMessage(messageId);

	if (!message) {
		return null;
	}

	return <MessageBody className={className} isStreaming={isStreaming} message={message} />;
};

ChatMessageById.displayName = "ChatMessageById";

export const ChatMessage = ({ className, message }: { className?: string; message: BaseChatUIMessage }) => (
	<MessageBody className={className} message={message} />
);
