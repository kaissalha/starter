"use client";

import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { v4 as uuidv4 } from "uuid";

import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { ChatContent } from "@/components/chat/chat-content";
import { ChatHistoryButton } from "@/components/chat/chat-history-button";
import { ChatComposer } from "@/components/chat/chat-input/chat-composer";
import { ChatNewChatButton } from "@/components/chat/chat-new-chat-button";
import { ChatSessionProvider, useChatSession } from "@/components/chat/stores/chat-session-store";
import { useRouter } from "@/i18n/navigation";
import { apiClient } from "@/lib/api-client";
import type { DashboardChatUIMessage } from "@starter/server";
import { SidebarTrigger } from "@starter/ui/components/sidebar";

import { DashboardOverview } from "./dashboard-overview";
import { DashboardWeather } from "./dashboard-weather";

type DashboardHomePageProps = {
	chatId: string;
	greeting: string;
	initialMessages?: Array<DashboardChatUIMessage>;
	onNewChat?: () => void;
};

const EMPTY_INITIAL_MESSAGES: Array<DashboardChatUIMessage> = [];

export const DashboardNewHomePage = ({ greeting }: { greeting: string }) => {
	const [chatId, setChatId] = useState(() => uuidv4());

	return <DashboardHomePage chatId={chatId} greeting={greeting} onNewChat={() => setChatId(uuidv4())} />;
};

export const DashboardHomePage = ({
	chatId,
	greeting,
	initialMessages = EMPTY_INITIAL_MESSAGES,
	onNewChat,
}: DashboardHomePageProps) => {
	const router = useRouter();
	const queryClient = useQueryClient();

	const handleChatCreated = (createdChatId: string) => {
		queryClient.invalidateQueries({ queryKey: apiClient.chats.list.key() });
		const url = new URL(window.location.href);
		url.searchParams.set("chatId", createdChatId);
		window.history.replaceState(null, "", url);
	};

	const handleNewChat = () => {
		onNewChat?.();
		router.push("/dashboard");
	};

	return (
		<ChatSessionProvider
			initialMessages={initialMessages}
			key={chatId}
			runtime={{
				chatId,
				onChatCreated: handleChatCreated,
			}}
		>
			<DashboardHomeContent chatId={chatId} greeting={greeting} onNewChat={handleNewChat} />
		</ChatSessionProvider>
	);
};

type DashboardHomeContentProps = {
	chatId: string;
	greeting: string;
	onNewChat: () => void;
};

const DashboardHomeContent = ({ chatId, greeting, onNewChat }: DashboardHomeContentProps) => {
	const tHome = useTranslations("dashboard.home");
	const tCommon = useTranslations("common");
	const hasMessages = useChatSession((state) => state.messages.length > 0);

	if (hasMessages) {
		return (
			<>
				<Header
					actions={
						<>
							<ChatHistoryButton currentChatId={chatId} />
							<ChatNewChatButton onClick={onNewChat} />
						</>
					}
					item={{ labelTx: "chat" }}
				/>
				<div className='min-h-0 flex-1 overflow-hidden'>
					<ChatContent />
				</div>
			</>
		);
	}

	return (
		<div className='relative flex min-h-0 flex-1 flex-col'>
			<header className='flex shrink-0 items-center px-4 py-3 md:hidden'>
				<SidebarTrigger
					aria-label={tCommon("toggleNavigation")}
					className='-ms-1 shrink-0 md:hidden'
					purpose='navigation'
				/>
			</header>
			<div className='min-h-0 flex-1 overflow-y-auto'>
				<div className='flex w-full flex-col gap-6 px-4 pb-44 md:px-10 md:pt-4'>
					<div className='flex flex-wrap items-center justify-between gap-4'>
						<div className='flex flex-col gap-2'>
							<h1 className='text-3xl leading-tight'>{greeting},</h1>
							<p className='text-sm text-muted-foreground'>{tHome("subtitle")}</p>
						</div>
						<div className='hidden md:block'>
							<DashboardWeather />
						</div>
					</div>
					<DashboardOverview />
				</div>
			</div>
			<div className='pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4 md:px-10'>
				<ChatComposer containerClassName='pointer-events-auto mx-auto w-full max-w-3xl' />
			</div>
		</div>
	);
};
