import { useInfiniteQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

export const useChatHistory = () =>
	useInfiniteQuery(
		apiClient.chats.list.infiniteOptions<number>({
			getNextPageParam: (page) => page.nextPage ?? undefined,
			initialPageParam: 0,
			input: (page) => ({ page }),
			refetchInterval: (query) =>
				query.state.data?.pages.some((page) =>
					page.chats.some((chat) => !chat.title && Date.now() - Date.parse(chat.updatedAt) < 5 * 60 * 1000)
				)
					? 5000
					: false,
			staleTime: 30 * 1000,
		})
	);
