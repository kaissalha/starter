"use client";

import { useDeferredValue, useRef } from "react";

import { FolderLibraryIcon, Upload04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { SearchableHeader } from "@/app/[locale]/dashboard/components/layout/header/searchable-header";
import { ChatSessionProvider } from "@/components/chat/stores/chat-session-store";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient } from "@/lib/api-client";
import { Button } from "@starter/ui/components/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@starter/ui/components/empty";
import { Skeleton } from "@starter/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@starter/ui/components/tabs";

import { LibraryAssetCard } from "./library-asset-card";
import { LibraryChatDock } from "./library-chat-dock";
import { LibraryChatRefresh } from "./library-chat-refresh";
import { LibraryFilters } from "./library-filters";
import { libraryKinds, librarySearchParams } from "./library-search-params";
import { useLibraryChatSession } from "./use-library-chat-session";
import { useLibraryUpload } from "./use-library-upload";

const LibraryContent = ({ chat, onNewChat }: { chat: boolean; onNewChat: () => void }) => {
	const { can } = useOrganizationPermissions();
	const t = useTranslations("library");
	const queryClient = useQueryClient();
	const fileInput = useRef<HTMLInputElement>(null);
	const [params, setParams] = useQueryStates(librarySearchParams);
	const search = useDeferredValue(params.q);

	const query = useInfiniteQuery({
		...apiClient.library.list.infiniteOptions({
			getNextPageParam: (page) => page.nextOffset,
			initialPageParam: 0,
			input: (offset: number) => ({
				kind: params.kind,
				offset,
				query: search,
				sort: params.sort,
				source: params.source,
				versions: params.versions,
			}),
		}),
		placeholderData: keepPreviousData,
		refetchInterval: (current) =>
			current.state.data?.pages.some((page) =>
				page.items.some(({ generating, status }) => generating || status === "pending")
			)
				? 3000
				: false,
	});

	const uploads = useLibraryUpload({
		onUploaded: () => queryClient.invalidateQueries({ queryKey: apiClient.library.key() }),
	});

	const items = query.data?.pages.flatMap((page) => page.items) ?? [];
	const counts = query.data?.pages[0]?.counts;
	const empty = counts?.all === 0 && !search && params.source === "all";

	const files = (
		<main className='min-h-0 flex-1 overflow-y-auto p-4 pb-40 md:p-6 md:pb-40 group-has-[[data-library-conversation]]/library:pb-[calc(min(50dvh,32rem)+13rem)]'>
			{uploads.error && (
				<p className='mb-4 text-sm text-destructive' role='alert'>
					{t(uploads.error === "invalid" ? "uploadInvalid" : "uploadFailed")}
				</p>
			)}
			{query.isError && (
				<Empty role='alert'>
					<EmptyTitle>{t("loadError")}</EmptyTitle>
					<EmptyContent>
						<Button onClick={() => query.refetch()} variant='outline'>
							{t("retry")}
						</Button>
					</EmptyContent>
				</Empty>
			)}
			{empty ? (
				<Empty className='min-h-80'>
					<EmptyHeader>
						<EmptyMedia variant='icon'>
							<HugeiconsIcon aria-hidden icon={FolderLibraryIcon} strokeWidth={1.75} />
						</EmptyMedia>
						<EmptyTitle>{t("emptyTitle")}</EmptyTitle>
					</EmptyHeader>
				</Empty>
			) : (
				<div className='grid gap-4'>
					<div className='min-w-0 overflow-x-auto no-scrollbar'>
						<Tabs
							onValueChange={(kind) => setParams({ kind: libraryKinds.find((value) => value === kind) })}
							value={params.kind}
						>
							<TabsList className='justify-self-start' variant='toggle'>
								{libraryKinds.map((kind) => (
									<TabsTrigger key={kind} value={kind}>
										{t(`kinds.${kind}`)}
										{counts && (
											<span className='text-muted-foreground tabular-nums'>{counts[kind]}</span>
										)}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>
					<div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'>
						{query.isPending &&
							["a", "b", "c", "d"].map((key) => (
								<Skeleton aria-label={t("loading")} className='aspect-[4/3]' key={key} role='status' />
							))}
						{items.map((asset) => (
							<LibraryAssetCard asset={asset} key={asset.id} />
						))}
					</div>
					{query.data && items.length === 0 && (
						<Empty className='min-h-64'>
							<EmptyTitle>{t("noResults")}</EmptyTitle>
						</Empty>
					)}
					{query.hasNextPage && (
						<Button
							className='justify-self-center'
							loading={query.isFetchingNextPage}
							onClick={() => query.fetchNextPage()}
							variant='outline'
						>
							{t("loadMore")}
						</Button>
					)}
				</div>
			)}
		</main>
	);

	return (
		<div className='group/library relative flex min-w-0 flex-1 flex-col'>
			<SearchableHeader
				actions={
					<>
						<LibraryFilters />
						{can("workspace.write") && (
							<>
								<input
									aria-label={t("upload")}
									className='hidden'
									multiple
									onChange={(event) => {
										uploads.upload(Array.from(event.target.files ?? []));
										event.target.value = "";
									}}
									ref={fileInput}
									type='file'
								/>
								<Button
									aria-label={t("upload")}
									loading={uploads.uploading}
									onClick={() => fileInput.current?.click()}
								>
									<HugeiconsIcon className='scale-110' icon={Upload04Icon} strokeWidth={1.75} />
									<span className='hidden sm:inline'>{t("upload")}</span>
								</Button>
							</>
						)}
					</>
				}
				className='flex-nowrap gap-2 px-4 md:px-5'
				item={{ labelTx: "library" }}
				leading={
					<>
						<HugeiconsIcon
							aria-hidden
							className='hidden size-4 scale-110 text-muted-foreground sm:block'
							icon={FolderLibraryIcon}
							strokeWidth={1.75}
						/>
						<h1 className='text-base'>{t("title")}</h1>
					</>
				}
				onSearchChange={(q) => setParams({ q })}
				search={params.q}
				searchPlaceholder={t("search")}
			/>
			{chat && can("workspace.write") ? <LibraryChatDock onNewChat={onNewChat}>{files}</LibraryChatDock> : files}
		</div>
	);
};

const libraryBinding = {};

export const LibraryPage = () => {
	const queryClient = useQueryClient();
	const { session, startNewChat } = useLibraryChatSession({});

	if (!session) {
		return <LibraryContent chat={false} onNewChat={startNewChat} />;
	}

	return (
		<ChatSessionProvider
			initialMessages={session.messages}
			key={session.chatId}
			runtime={{
				chatId: session.chatId,
				library: libraryBinding,
				onDataChange: {
					library: () => queryClient.invalidateQueries({ queryKey: apiClient.library.list.key() }),
				},
			}}
		>
			<LibraryChatRefresh
				onRefresh={() => queryClient.invalidateQueries({ queryKey: apiClient.library.list.key() })}
			/>
			<LibraryContent chat onNewChat={startNewChat} />
		</ChatSessionProvider>
	);
};
