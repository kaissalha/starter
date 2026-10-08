"use client";

import { useRef } from "react";

import { InboxIcon, Notification03Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useSettings } from "@/hooks/use-settings";
import { Button } from "@starter/ui/components/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@starter/ui/components/popover";
import { ScrollArea } from "@starter/ui/components/scroll-area";
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "@starter/ui/components/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@starter/ui/components/tabs";

import { NotificationRow } from "./notification-row";
import {
	useNotificationsController,
	type NotificationGroup,
	type NotificationTab,
} from "./use-notifications-controller";

type NotificationListProps = {
	controller: ReturnType<typeof useNotificationsController>;
	onOpen: (group: NotificationGroup) => void;
};

const NotificationList = ({ controller, onOpen }: NotificationListProps) => {
	const t = useTranslations("notifications");
	const { list, tab } = controller;

	if (list.isPending) {
		return (
			<div className='space-y-2 px-5 py-3'>
				<div className='h-12 animate-pulse rounded-xl bg-muted' />
				<div className='h-12 animate-pulse rounded-xl bg-muted' />
				<div className='h-12 animate-pulse rounded-xl bg-muted' />
			</div>
		);
	}

	if (list.isError) {
		return (
			<div className='p-6 text-center text-sm' role='alert'>
				<p className='text-muted-foreground'>{t("loadFailed")}</p>
				<Button className='mt-2' onClick={() => list.refetch()} size='sm' variant='outline'>
					{t("retry")}
				</Button>
			</div>
		);
	}

	if (controller.groups.length === 0) {
		return (
			<div className='flex flex-1 flex-col items-center justify-center gap-3 py-16'>
				<span className='flex size-12 items-center justify-center rounded-full bg-accent'>
					<HugeiconsIcon aria-hidden className='scale-110' icon={InboxIcon} strokeWidth={1.75} />
				</span>
				<p className='text-sm text-muted-foreground'>{t(`empty.${tab}`)}</p>
			</div>
		);
	}

	return (
		<ScrollArea className='min-h-0 flex-1' scrollFade>
			<div className='divide-y divide-border'>
				{controller.groups.map((group) => (
					<NotificationRow
						group={group}
						key={group.key}
						onArchive={tab === "inbox" ? controller.archiveGroup : undefined}
						onOpen={onOpen}
					/>
				))}
			</div>
			{list.hasNextPage && (
				<div className='p-2'>
					<Button
						className='w-full'
						loading={list.isFetchingNextPage}
						onClick={() => list.fetchNextPage()}
						size='sm'
						variant='ghost'
					>
						{t("loadMore")}
					</Button>
				</div>
			)}
		</ScrollArea>
	);
};

export const NotificationBell = () => {
	const t = useTranslations("notifications");
	const [, setSettings] = useSettings();
	const { isMobile, setOpenMobile, side } = useSidebar("navigation");
	const controller = useNotificationsController();
	const itemRef = useRef<HTMLLIElement>(null);
	const desktopPopupSide = side === "left" ? "right" : "left";

	const closeMobileSidebar = () => {
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	return (
		<SidebarMenuItem ref={itemRef}>
			<Popover onOpenChange={controller.setOpen} open={controller.open}>
				<SidebarMenuButton className='relative' render={<PopoverTrigger />} tooltip={t("bell")}>
					<HugeiconsIcon
						aria-hidden='true'
						className='scale-110'
						icon={Notification03Icon}
						strokeWidth={1.75}
					/>
					<span data-sidebar-label>{t("bell")}</span>
					{controller.unseen > 0 && (
						<span
							aria-hidden
							className='absolute start-7 top-2 size-1.5 rounded-full bg-primary md:start-5 md:top-1.5'
						/>
					)}
				</SidebarMenuButton>
				<PopoverPopup
					align='end'
					anchor={itemRef}
					className='flex h-[min(var(--available-height),33rem)] w-[min(calc(100vw-2rem),25rem)] flex-col overflow-hidden'
					padding='none'
					side={isMobile ? "top" : desktopPopupSide}
					sideOffset={16}
				>
					<Tabs
						className='flex min-h-0 flex-1 flex-col'
						onValueChange={(value: NotificationTab) => controller.setTab(value)}
						spacing='none'
						value={controller.tab}
					>
						<div className='relative'>
							<TabsList>
								<TabsTrigger size='lg' value='inbox'>
									{t("tabs.inbox")}
								</TabsTrigger>
								<TabsTrigger size='lg' value='archive'>
									{t("tabs.archive")}
								</TabsTrigger>
							</TabsList>
							<div className='absolute inset-y-0 end-3 flex items-center'>
								<Button
									aria-label={t("settings")}
									onClick={() => {
										controller.setOpen(false);
										closeMobileSidebar();
										setSettings("notifications");
									}}
									size='icon-sm'
									variant='ghost'
								>
									<HugeiconsIcon
										aria-hidden
										className='scale-110'
										icon={Settings01Icon}
										strokeWidth={1.75}
									/>
								</Button>
							</div>
						</div>
						<NotificationList
							controller={controller}
							onOpen={(group) => {
								controller.openGroup(group);
								closeMobileSidebar();
							}}
						/>
						{controller.tab === "inbox" && controller.groups.length > 0 && (
							<div className='flex justify-center border-t border-border p-2'>
								<Button onClick={controller.archiveAll} size='sm' variant='ghost'>
									{t("archiveAll")}
								</Button>
							</div>
						)}
					</Tabs>
				</PopoverPopup>
			</Popover>
		</SidebarMenuItem>
	);
};
