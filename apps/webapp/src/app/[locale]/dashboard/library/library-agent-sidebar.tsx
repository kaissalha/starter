"use client";

import { useMemo } from "react";

import { useTranslations } from "next-intl";

import { ChatContent } from "@/components/chat/chat-content";
import { ChatNewChatButton } from "@/components/chat/chat-new-chat-button";
import { ChatSessionProvider, useChatSession } from "@/components/chat/stores/chat-session-store";
import { Button } from "@starter/ui/components/button";
import { Sidebar, useSidebar } from "@starter/ui/components/sidebar";

import { LibraryChatRefresh } from "./library-chat-refresh";
import { useLibraryChatSession } from "./use-library-chat-session";

const LibraryNewChatBar = ({ onNewChat }: { onNewChat: () => void }) => {
	const hasMessages = useChatSession((state) => state.messages.length > 0);

	if (!hasMessages) {
		return null;
	}

	return (
		<div className='absolute end-2 top-2 z-50'>
			<ChatNewChatButton onClick={onNewChat} />
		</div>
	);
};

export const LibraryAgentSidebar = ({
	assetId,
	onChange,
	onRefresh,
}: {
	assetId?: string;
	onChange: () => void;
	onRefresh: () => void;
}) => {
	const t = useTranslations("library.agent");
	const tCommon = useTranslations("common");
	const { isMobile, open, openMobile } = useSidebar("details");
	const { query, session, startNewChat } = useLibraryChatSession({ assetId, enabled: isMobile ? openMobile : open });
	const library = useMemo(() => ({ assetId }), [assetId]);

	return (
		<Sidebar
			className='overflow-clip max-md:h-[min(42rem,90dvh)]'
			mobilePosition='bottom'
			purpose='details'
			surface='canvas'
		>
			{session ? (
				<ChatSessionProvider
					initialMessages={session.messages}
					key={session.chatId}
					runtime={{ chatId: session.chatId, library, onDataChange: { library: onChange } }}
				>
					<LibraryChatRefresh onRefresh={onRefresh} />
					<LibraryNewChatBar onNewChat={startNewChat} />
					<ChatContent
						composerAreaClassName='px-2 pb-[max(.5rem,env(safe-area-inset-bottom))]'
						composerClassName='[&_[data-slot=chat-input]]:rounded-[24px] [&_[data-slot=chat-input]]:smooth-shadow-ring-md [&_[data-slot=chat-input-body]]:p-3 [&_[data-slot=chat-input-textarea]]:flex'
						emptyState={
							<h2 className='max-w-sm px-8 pb-24 text-center text-lg font-medium'>
								{t(assetId ? "assetTitle" : "title")}
							</h2>
						}
						messageClassName='md:px-4'
						placeholder={t(assetId ? "assetPlaceholder" : "placeholder")}
					/>
				</ChatSessionProvider>
			) : (
				<div
					className='flex h-full flex-col items-center justify-center gap-3 p-6'
					role={query.isError ? "alert" : "status"}
				>
					<p className='text-sm text-muted-foreground'>
						{query.isError ? tCommon("messages.somethingWentWrong") : tCommon("loading")}
					</p>
					{query.isError && (
						<Button onClick={() => query.refetch()} size='sm' variant='outline'>
							{tCommon("retry")}
						</Button>
					)}
				</div>
			)}
		</Sidebar>
	);
};
