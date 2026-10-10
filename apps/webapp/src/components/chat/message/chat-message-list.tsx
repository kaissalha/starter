"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { StickToBottom } from "use-stick-to-bottom";

import { useChatSession } from "@/components/chat/chat-session";
import { ChatMessage } from "@/components/chat/message/chat-message";
import { ThinkingSteps } from "@/components/chat/message/chat-step-item";
import { cn } from "@starter/ui/lib/utils";

const ChatEmptyState = () => {
	const t = useTranslations("chats");

	return (
		<div className='mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 text-center'>
			<div className='space-y-2'>
				<h2 className='text-2xl font-semibold text-foreground'>{t("startConversation")}</h2>
				<p className='text-sm text-muted-foreground'>{t("askAnything")}</p>
			</div>
		</div>
	);
};

export const ChatMessageList = ({
	className,
	contentClassName,
	emptyState,
}: {
	className?: string;
	contentClassName?: string;
	emptyState?: ReactNode;
}) => {
	const { error, isLoading, messages } = useChatSession();
	const lastMessage = messages.at(-1);

	if (!lastMessage) {
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
				<div
					className={cn(
						"mx-auto h-fit w-full max-w-3xl overflow-x-hidden px-4 pb-32 md:px-0",
						contentClassName
					)}
				>
					{messages.map((message) => (
						<div
							className='w-full [contain-intrinsic-size:0_120px] [content-visibility:auto]'
							key={message.id}
						>
							<ChatMessage
								isStreaming={isLoading && message.role === "assistant" && message === lastMessage}
								message={message}
							/>
						</div>
					))}
					{isLoading && lastMessage.role === "user" && (
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
			</StickToBottom.Content>
		</StickToBottom>
	);
};
