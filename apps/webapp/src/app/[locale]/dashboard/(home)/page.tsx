import { Suspense } from "react";

import { connection } from "next/server";

import { z } from "zod";

import { serverApiClient } from "@/lib/server/api-client";
import { getServerSession } from "@/lib/server/auth";
import { getQueryClient, prefetch } from "@/lib/server/query-client";
import { HydrateClient } from "@/lib/server/react-query";
import { getGreetingFromTimezone } from "@/utils/greeting";
import { convertChatMessagesForUI, getChatWithMessages } from "@starter/server";
import { Skeleton } from "@starter/ui/components/skeleton";

import { DashboardHomePage, DashboardNewHomePage } from "./components/dashboard-home-page";

export const instant = false;

const chatIdSchema = z.compile(z.uuid());

type DashboardPageProps = {
	searchParams: Promise<{ chatId?: string | Array<string> }>;
};

const DashboardPageContent = async ({ searchParams }: DashboardPageProps) => {
	await connection();

	const [{ chatId: requestedChatId }, session, greeting] = await Promise.all([
		searchParams,
		getServerSession(),
		getGreetingFromTimezone(),
	]);

	const parsedChatId = chatIdSchema.safeParse(requestedChatId);

	if (!session) {
		throw new Error("No session found");
	}

	if (!parsedChatId.success) {
		const queryClient = getQueryClient();
		prefetch(queryClient.query(serverApiClient.websites.get.queryOptions()));
		prefetch(queryClient.query(serverApiClient.linkPages.get.queryOptions()));
		prefetch(queryClient.query(serverApiClient.contacts.list.queryOptions({ input: { pageSize: 3 } })));
		prefetch(queryClient.query(serverApiClient.blogPosts.list.queryOptions({ input: { pageSize: 3 } })));
		prefetch(
			queryClient.infiniteQuery(
				serverApiClient.chats.list.infiniteOptions<number>({
					getNextPageParam: (page) => page.nextPage ?? undefined,
					initialPageParam: 0,
					input: (page) => ({ page }),
				})
			)
		);

		return (
			<HydrateClient>
				<DashboardNewHomePage greeting={greeting} />
			</HydrateClient>
		);
	}

	const organizationId = session.session.activeOrganizationId;

	if (!organizationId) {
		throw new Error("No active workspace found");
	}

	const chatId = parsedChatId.data;
	const existingChat = await getChatWithMessages({ chatId, organizationId });
	const initialMessages = existingChat ? await convertChatMessagesForUI(existingChat.messages) : [];

	return <DashboardHomePage chatId={chatId} greeting={greeting} initialMessages={initialMessages} key={chatId} />;
};

export default function DashboardPage(props: DashboardPageProps) {
	return (
		<Suspense
			fallback={
				<div className='flex w-full flex-1 flex-col gap-6 px-4 py-5 md:px-10 md:py-8'>
					<Skeleton className='h-9 w-64 max-w-full' />
					<Skeleton className='h-4 w-96 max-w-full' />
					<div className='grid gap-4 lg:grid-cols-3'>
						<Skeleton className='h-96 w-full' />
						<Skeleton className='h-96 w-full' />
						<Skeleton className='h-96 w-full' />
					</div>
					<Skeleton className='mx-auto mt-auto h-28 w-full max-w-3xl' />
				</div>
			}
		>
			<DashboardPageContent {...props} />
		</Suspense>
	);
}
