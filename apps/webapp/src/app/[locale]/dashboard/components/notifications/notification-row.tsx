"use client";

import { Archive02Icon, Globe02Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";

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
	const { contact, createdAt, groupKey, params, readAt, subject, type } = group.lead;
	const name = contact?.name || contact?.email || t("unknownSender");
	const contactMessage = type === "contact_message_received";

	const title = contactMessage
		? t("types.contact_message_received.title", { count: group.items.length, name })
		: t(`types.${type}.title`, {
				days: Number(params.days ?? 0),
				domain: String(params.domain ?? ""),
				hostname: String(params.hostname ?? ""),
			});

	return (
		<div className='flex items-center gap-2 px-5 py-3 hover:bg-accent/50'>
			<Link
				className='flex min-w-0 flex-1 items-center gap-3 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-ring'
				href={
					contactMessage
						? `/dashboard/contacts?contact=${groupKey}&contactTab=messages&messageId=${subject.id}`
						: "/dashboard/website?websiteSettings=domains"
				}
				onClick={() => onOpen(group)}
			>
				<span className='flex size-9 shrink-0 items-center justify-center rounded-full border border-border'>
					<HugeiconsIcon
						aria-hidden
						className='size-4 scale-110'
						icon={contactMessage ? Mail01Icon : Globe02Icon}
						strokeWidth={1.75}
					/>
				</span>
				<span className='flex min-w-0 flex-col gap-0.5'>
					<span className={cn("text-sm", !readAt && "font-medium")}>{title}</span>
					<span className='text-xs text-muted-foreground'>
						{format.relativeTime(new Date(createdAt), now)}
					</span>
				</span>
			</Link>
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
