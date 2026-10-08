"use client";

import type { ReactNode } from "react";

import { StickToBottom } from "use-stick-to-bottom";

import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { ChatMessage, ChatMessageById } from "@/components/chat/message/chat-message";
import { ThinkingSteps } from "@/components/chat/message/thinking-step";
import { useChatMessageIds, useChatSession } from "@/components/chat/stores/chat-session-store";
import { cn } from "@starter/ui/lib/utils";

type ChatMessageListProps = {
	className?: string;
	contentClassName?: string;
	emptyState?: ReactNode;
};

export const ChatMessageList = ({ className, contentClassName, emptyState }: ChatMessageListProps) => {
	const hasMessages = useChatSession((state) => state.messages.length > 0);

	if (!hasMessages) {
		return <div className='flex w-full flex-1 items-center justify-center'>{emptyState ?? <ChatEmptyState />}</div>;
	}

	return (
		<StickToBottom
			className={cn("relative min-h-0 flex-1 overflow-y-hidden", className)}
			initial='smooth'
			resize='smooth'
			role='log'
		>
			<StickToBottom.Content scrollClassName='no-scrollbar'>
				<MessageListContent className={contentClassName} />
			</StickToBottom.Content>
		</StickToBottom>
	);
};

const MessageListContent = ({ className }: { className?: string }) => {
	const messageIds = useChatMessageIds();

	const { error, lastRole, status } = useChatSession((state) => ({
		error: state.error,
		lastRole: state.messages.at(-1)?.role,
		status: state.status,
	}));

	const isLoading = status === "streaming" || status === "submitted";
	const lastMessageId = messageIds.at(-1);
	const isAwaitingFirstToken = isLoading && lastRole === "user";

	return (
		<div className={cn("mx-auto h-fit w-full max-w-3xl overflow-x-hidden px-4 pb-32 md:px-0", className)}>
			{messageIds.map((messageId) => {
				const isStreaming = isLoading && lastRole === "assistant" && messageId === lastMessageId;

				return (
					<div className='w-full [contain-intrinsic-size:0_120px] [content-visibility:auto]' key={messageId}>
						<ChatMessageById isStreaming={isStreaming} messageId={messageId} />
					</div>
				);
			})}
			{isAwaitingFirstToken && (
				<div className='flex w-full items-start py-5'>
					<ThinkingSteps />
				</div>
			)}
			{error && (
				<ChatMessage
					message={{
						id: error.message,
						parts: [{ data: { message: error.message }, type: "data-error" }],
						role: "assistant",
					}}
				/>
			)}
		</div>
	);
};

ChatMessageList.displayName = "ChatMessageList";
