"use client";

import { useState, type ReactNode } from "react";

import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { ChatComposer } from "@/components/chat/chat-input/chat-composer";
import { ChatMessage, ChatMessageById } from "@/components/chat/message/chat-message";
import { ThinkingSteps } from "@/components/chat/message/thinking-step";
import { useChatMessageIds, useChatSession } from "@/components/chat/stores/chat-session-store";
import { Button } from "@starter/ui/components/button";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@starter/ui/components/message-scroller";

const LibraryChatTranscriptItem = ({ messageId, streaming }: { messageId: string; streaming: boolean }) => {
	const fromUser = useChatSession((state) => state.messages.find(({ id }) => id === messageId)?.role === "user");

	return (
		<MessageScrollerItem messageId={messageId} scrollAnchor={fromUser}>
			<ChatMessageById isStreaming={streaming} messageId={messageId} />
		</MessageScrollerItem>
	);
};

const LibraryChatTranscript = () => {
	const t = useTranslations("library.agent");
	const messageIds = useChatMessageIds();
	const lastRole = useChatSession((state) => state.messages.at(-1)?.role);
	const error = useChatSession((state) => state.error);
	const loading = useChatSession((state) => state.status === "streaming" || state.status === "submitted");

	return (
		<MessageScrollerProvider autoScroll defaultScrollPosition='last-anchor' scrollPreviousItemPeek={48}>
			<MessageScroller className='h-[min(50dvh,32rem)]'>
				<MessageScrollerViewport>
					<MessageScrollerContent>
						{messageIds.map((id) => (
							<LibraryChatTranscriptItem
								key={id}
								messageId={id}
								streaming={loading && lastRole === "assistant" && id === messageIds.at(-1)}
							/>
						))}
						{loading && lastRole === "user" && (
							<MessageScrollerItem messageId='thinking'>
								<ThinkingSteps />
							</MessageScrollerItem>
						)}
						{error && (
							<MessageScrollerItem messageId='error'>
								<ChatMessage
									message={{
										id: error.message,
										parts: [{ data: { message: error.message }, type: "data-error" }],
										role: "assistant",
									}}
								/>
							</MessageScrollerItem>
						)}
					</MessageScrollerContent>
				</MessageScrollerViewport>
				<MessageScrollerButton label={t("scrollToEnd")} />
			</MessageScroller>
		</MessageScrollerProvider>
	);
};

export const LibraryChatDock = ({ children, onNewChat }: { children: ReactNode; onNewChat: () => void }) => {
	const t = useTranslations("library.agent");
	const tChats = useTranslations("chats");
	const messageCount = useChatSession((state) => state.messages.length);
	const [hiddenAt, setHiddenAt] = useState(0);

	return (
		<>
			{children}
			<div className='pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-4 pb-4 md:px-10'>
				{messageCount > hiddenAt && (
					<section
						aria-label={t("title")}
						className='pointer-events-auto relative mt-10 flex w-full max-w-3xl flex-col rounded-[24px] bg-background smooth-shadow-ring-md'
						data-library-conversation
					>
						<div className='absolute end-0 -top-10 z-10 flex gap-1.5'>
							<Button onClick={onNewChat} size='sm' variant='outline'>
								<HugeiconsIcon aria-hidden className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
								{tChats("newChat")}
							</Button>
							<Button
								aria-label={t("hideConversation")}
								onClick={() => setHiddenAt(messageCount)}
								size='icon-sm'
								variant='outline'
							>
								<HugeiconsIcon className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
							</Button>
						</div>
						<LibraryChatTranscript />
					</section>
				)}
				<ChatComposer
					className='[&_[data-slot=chat-input]]:rounded-[24px] [&_[data-slot=chat-input]]:smooth-shadow-ring-md'
					containerClassName='pointer-events-auto w-full max-w-3xl'
					placeholder={t("placeholder")}
				/>
			</div>
		</>
	);
};
