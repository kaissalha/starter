import { useEffect, useEffectEvent, useState } from "react";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api-client";
import { toast } from "@starter/ui/components/toaster";

export type NotificationTab = "archive" | "inbox";

type NotificationItem = Awaited<ReturnType<typeof apiClient.notifications.list.call>>["items"][number];

export type NotificationGroup = { items: Array<NotificationItem>; key: string; lead: NotificationItem };

const groupNotifications = (items: Array<NotificationItem>) =>
	items.reduce<Array<NotificationGroup>>((groups, item) => {
		const previous = groups.at(-1);

		if (
			previous &&
			!item.readAt &&
			!previous.lead.readAt &&
			item.groupKey &&
			item.type === previous.lead.type &&
			item.groupKey === previous.lead.groupKey
		) {
			previous.items.push(item);

			return groups;
		}

		groups.push({ items: [item], key: item.id, lead: item });

		return groups;
	}, []);

const useNotificationList = ({ enabled, tab }: { enabled: boolean; tab: NotificationTab }) =>
	useInfiniteQuery(
		apiClient.notifications.list.infiniteOptions<number | undefined>({
			enabled,
			getNextPageParam: (page) => page.nextCursor ?? undefined,
			initialPageParam: undefined,
			input: (cursor) => ({ cursor, tab }),
			staleTime: 15 * 1000,
		})
	);

export const useNotificationsController = () => {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState<NotificationTab>("inbox");

	const counts = useQuery(
		apiClient.notifications.counts.queryOptions({ refetchInterval: 30 * 1000, refetchOnWindowFocus: true })
	);

	const inbox = useNotificationList({ enabled: open, tab: "inbox" });
	const archive = useNotificationList({ enabled: open && tab === "archive", tab: "archive" });
	const tCommon = useTranslations("common");
	const invalidate = () => queryClient.invalidateQueries({ queryKey: apiClient.notifications.key() });
	const onError = () => toast.error(tCommon("messages.somethingWentWrong"));
	const markSeen = useMutation(apiClient.notifications.markSeen.mutationOptions({ onError, onSuccess: invalidate }));
	const markRead = useMutation(apiClient.notifications.markRead.mutationOptions({ onError, onSuccess: invalidate }));

	const archiveItems = useMutation(
		apiClient.notifications.archive.mutationOptions({ onError, onSuccess: invalidate })
	);

	const archiveAll = useMutation(
		apiClient.notifications.archiveAll.mutationOptions({ onError, onSuccess: invalidate })
	);

	const newestSequence = inbox.data?.pages[0]?.newestSequence ?? null;
	const unseen = counts.data?.unseen ?? 0;
	const markShownSeen = useEffectEvent((throughSequence: number) => markSeen.mutate({ throughSequence }));

	useEffect(() => {
		if (open && unseen > 0 && newestSequence !== null) {
			markShownSeen(newestSequence);
		}
	}, [newestSequence, open, unseen]);

	const activeList = tab === "inbox" ? inbox : archive;

	return {
		archiveAll: () => newestSequence !== null && archiveAll.mutate({ throughSequence: newestSequence }),
		archiveGroup: (group: NotificationGroup) => archiveItems.mutate({ ids: group.items.map(({ id }) => id) }),
		groups: groupNotifications(activeList.data?.pages.flatMap((page) => page.items) ?? []),
		list: activeList,
		open,
		openGroup: (group: NotificationGroup) => {
			setOpen(false);
			const unread = group.items.filter((item) => !item.readAt).map(({ id }) => id);

			if (unread.length > 0) {
				markRead.mutate({ ids: unread });
			}
		},
		setOpen,
		setTab,
		tab,
		unseen,
	};
};
