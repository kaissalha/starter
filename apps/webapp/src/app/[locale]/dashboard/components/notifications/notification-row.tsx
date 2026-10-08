"use client";

import { Archive02Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";

import { useNotificationTranslator } from "./use-notification-translator";
import type { NotificationGroup } from "./use-notifications-controller";

type NotificationRowProps = {
	group: NotificationGroup;
	onArchive?: (group: NotificationGroup) => void;
	onOpen: (group: NotificationGroup) => void;
};

export const NotificationRow = ({ group, onArchive, onOpen }: NotificationRowProps) => {
	const t = useTranslations("notifications");
	const format = useFormatter();
	const now = useNow();
	const { createdAt, readAt, type } = group.lead;
	const title = useNotificationTranslator().type({ key: "title", type, values: { count: group.items.length } });

	return (
		<div className='flex items-center gap-2 px-5 py-3 hover:bg-accent/50'>
			<button
				className='flex min-w-0 flex-1 items-center gap-3 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-ring'
				onClick={() => onOpen(group)}
				type='button'
			>
				<span className='flex size-9 shrink-0 items-center justify-center rounded-full border border-border'>
					<HugeiconsIcon
						aria-hidden
						className='size-4 scale-110'
						icon={Notification01Icon}
						strokeWidth={1.75}
					/>
				</span>
				<span className='flex min-w-0 flex-col gap-0.5'>
					<span className={cn("text-sm", !readAt && "font-medium")}>{title}</span>
					<span className='text-xs text-muted-foreground'>
						{format.relativeTime(new Date(createdAt), now)}
					</span>
				</span>
			</button>
			{onArchive && (
				<Button
					aria-label={t("archive")}
					className='shrink-0'
					onClick={() => onArchive(group)}
					size='icon'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden className='scale-110' icon={Archive02Icon} strokeWidth={1.75} />
				</Button>
			)}
		</div>
	);
};
