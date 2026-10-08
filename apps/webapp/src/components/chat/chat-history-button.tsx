"use client";

import { useState } from "react";

import { HistoryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { useChatHistory } from "@/components/chat/use-chat-history";
import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";
import { Popover, PopoverItem, PopoverPopup, PopoverTrigger } from "@starter/ui/components/popover";
import { ScrollArea } from "@starter/ui/components/scroll-area";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@starter/ui/components/tooltip";

export const ChatHistoryButton = ({ currentChatId }: { currentChatId?: string }) => {
	const t = useTranslations("chats");
	const format = useFormatter();
	const now = useNow();
	const [open, setOpen] = useState(false);

	const historyQuery = useChatHistory();

	const chats = historyQuery.data?.pages.flatMap((page) => page.chats);

	const label = t("history");

	const historyContent = (() => {
		if (historyQuery.isPending) {
			return (
				<div className='space-y-2 p-2'>
					<div className='h-8 animate-pulse rounded-xl bg-muted' />
					<div className='h-8 animate-pulse rounded-xl bg-muted' />
					<div className='h-8 animate-pulse rounded-xl bg-muted' />
				</div>
			);
		}

		if (historyQuery.isError) {
			return (
				<div className='p-3 text-center text-sm' role='alert'>
					<p className='text-muted-foreground'>{t("loadFailed")}</p>
					<Button className='mt-2' onClick={() => historyQuery.refetch()} size='sm' variant='outline'>
						{t("retry")}
					</Button>
				</div>
			);
		}

		if (chats && chats.length > 0) {
			return (
				<ScrollArea className='flex-1' scrollbarGutter scrollFade>
					<div className='flex flex-col gap-0.5 in-data-has-overflow-y:pe-1'>
						{chats.map((chat) => (
							<Link
								aria-current={chat.id === currentChatId ? "page" : undefined}
								className='rounded-xl'
								href={`/dashboard?chatId=${chat.id}`}
								key={chat.id}
								onClick={(event) => {
									setOpen(false);

									if (chat.id === currentChatId) {
										event.preventDefault();
									}
								}}
								prefetch={true}
							>
								<PopoverItem selected={chat.id === currentChatId}>
									<span className='min-w-0 truncate'>{chat.title ?? t("newChat")}</span>
									<span className='shrink-0 text-xs font-normal text-muted-foreground'>
										{format.relativeTime(new Date(chat.updatedAt), now)}
									</span>
								</PopoverItem>
							</Link>
						))}
						{historyQuery.hasNextPage && (
							<Button
								className='mt-1 w-full'
								loading={historyQuery.isFetchingNextPage}
								onClick={() => historyQuery.fetchNextPage()}
								size='sm'
								variant='ghost'
							>
								{t("loadMore")}
							</Button>
						)}
					</div>
				</ScrollArea>
			);
		}

		return <p className='px-3 py-6 text-center text-sm text-muted-foreground'>{t("noHistory")}</p>;
	})();

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<TooltipProvider delay={0}>
				<Tooltip>
					<TooltipTrigger
						delay={0}
						render={
							<PopoverTrigger
								render={<Button aria-label={label} size='icon' type='button' variant='ghost' />}
							/>
						}
					>
						<HugeiconsIcon aria-hidden className='scale-110' icon={HistoryIcon} strokeWidth={1.75} />
					</TooltipTrigger>
					<TooltipPopup>{label}</TooltipPopup>
				</Tooltip>
			</TooltipProvider>
			<PopoverPopup
				align='end'
				aria-live='polite'
				className='flex w-80 max-h-[min(var(--available-height),20rem)] flex-col overflow-hidden'
				padding='sm'
				side='bottom'
			>
				{historyContent}
			</PopoverPopup>
		</Popover>
	);
};
