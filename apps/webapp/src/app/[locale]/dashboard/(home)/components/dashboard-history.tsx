"use client";

import { BubbleChatIcon, HistoryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { useChatHistory } from "@/components/chat/use-chat-history";
import { Button } from "@starter/ui/components/button";
import { Skeleton } from "@starter/ui/components/skeleton";

import {
	DashboardFrame,
	DashboardFrameEmpty,
	DashboardFrameHeader,
	DashboardFramePanel,
	DashboardFrameRow,
} from "./dashboard-frame";

export const DashboardHistory = () => {
	const t = useTranslations("chats");
	const tOverview = useTranslations("dashboard.home.overview");
	const format = useFormatter();
	const now = useNow();
	const history = useChatHistory();
	const chats = history.data?.pages.flatMap((page) => page.chats);

	return (
		<DashboardFrame className='min-h-64' label={tOverview("agents")}>
			<DashboardFrameHeader icon={HistoryIcon} title={tOverview("agents")} />
			<DashboardFramePanel>
				{history.isPending && (
					<div aria-label={tOverview("loadingRecords")} className='grid gap-1' role='status'>
						<Skeleton className='h-12 w-full' />
						<Skeleton className='h-12 w-full' />
						<Skeleton className='h-12 w-full' />
					</div>
				)}
				{history.isError && (
					<DashboardFrameEmpty icon={HistoryIcon}>
						<p role='alert'>{t("loadFailed")}</p>
						<Button onClick={() => history.refetch()} size='sm' variant='secondary'>
							{t("retry")}
						</Button>
					</DashboardFrameEmpty>
				)}
				{history.isSuccess && chats?.length === 0 && (
					<DashboardFrameEmpty icon={HistoryIcon}>{t("noHistory")}</DashboardFrameEmpty>
				)}
				{chats && chats.length > 0 && (
					<ul className='grid max-h-[28rem] gap-0.5 overflow-y-auto'>
						{chats.map((chat) => (
							<DashboardFrameRow
								href={`/dashboard?chatId=${chat.id}`}
								key={chat.id}
								leading={
									<HugeiconsIcon
										aria-hidden
										className='size-4 shrink-0 scale-110 text-muted-foreground'
										icon={BubbleChatIcon}
										strokeWidth={1.75}
									/>
								}
								title={chat.title ?? t("newChat")}
								trailing={format.relativeTime(new Date(chat.updatedAt), now)}
							/>
						))}
					</ul>
				)}
				{history.hasNextPage && (
					<Button
						className='mt-auto self-center'
						loading={history.isFetchingNextPage}
						onClick={() => history.fetchNextPage()}
						size='sm'
						variant='ghost'
					>
						{t("loadMore")}
					</Button>
				)}
			</DashboardFramePanel>
		</DashboardFrame>
	);
};
