"use client";

import { Message01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import { DashboardDrawer, DashboardDrawerHeader } from "@/app/[locale]/dashboard/components/dashboard-drawer";
import { DashboardFrameHeader } from "@/app/[locale]/dashboard/components/dashboard-frame";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { DrawerPanel } from "@starter/ui/components/drawer";
import { Frame, FramePanel } from "@starter/ui/components/frame";
import { Skeleton } from "@starter/ui/components/skeleton";

type ContactMessage = Awaited<ReturnType<typeof apiClient.contacts.message.call>>;

const ContactMessageBadges = ({ message }: { message: ContactMessage }) => {
	const t = useTranslations("contacts");

	return (
		<ul aria-label={t("triageBadges")} className='flex flex-wrap gap-1.5'>
			{message.spamFlag && (
				<li>
					<Badge variant='critical'>{t("spamFlag")}</Badge>
				</li>
			)}
			{message.triageCategory && (
				<li>
					<Badge>{t(`triageCategories.${message.triageCategory}`)}</Badge>
				</li>
			)}
			{message.triageUrgency && (
				<li>
					<Badge variant={message.triageUrgency === "timeSensitive" ? "warning" : "default"}>
						{t(`triageUrgencies.${message.triageUrgency}`)}
					</Badge>
				</li>
			)}
		</ul>
	);
};

const ContactMessageTriage = ({ contactId, messageId }: { contactId: string; messageId: string }) => {
	const t = useTranslations("contacts");
	const queryClient = useQueryClient();

	const triage = useMutation(
		apiClient.contacts.triage.mutationOptions({
			onSuccess: (data) => {
				if (data.status === "suggested") {
					queryClient.invalidateQueries({ queryKey: apiClient.contacts.message.key() });
					queryClient.invalidateQueries({ queryKey: apiClient.contacts.messages.key() });
				}
			},
		})
	);

	return (
		<div className='space-y-2'>
			<Button
				loading={triage.isPending}
				onClick={() => triage.mutate({ contactId, messageId })}
				size='sm'
				variant='outline'
			>
				{t("triageAction")}
			</Button>
			{(triage.isError || triage.data?.status === "unavailable") && (
				<p className='text-sm text-muted-foreground' role='status'>
					{t("triageUnavailable")}
				</p>
			)}
		</div>
	);
};

export const ContactMessages = ({
	contactId,
	messageId,
	onMessageChange,
}: {
	contactId: string;
	messageId: string | null;
	onMessageChange: (messageId: string | null) => void;
}) => {
	const t = useTranslations("contacts");
	const format = useFormatter();
	const { can } = useOrganizationPermissions();

	const query = useInfiniteQuery(
		apiClient.contacts.messages.infiniteOptions<string | null>({
			getNextPageParam: (page) => page.meta.cursor ?? undefined,
			initialPageParam: null,
			input: (cursor) => ({ contactId, cursor }),
		})
	);

	const detail = useQuery(
		apiClient.contacts.message.queryOptions({
			enabled: Boolean(messageId),
			input: { contactId, messageId: messageId ?? "" },
		})
	);

	const messages = query.data?.pages.flatMap((page) => page.data) ?? [];

	return (
		<>
			{query.isPending && (
				<div aria-label={t("loading")} className='space-y-3' role='status'>
					<Skeleton className='h-10 w-full' />
					<Skeleton className='h-10 w-full' />
				</div>
			)}
			{query.isError && (
				<div className='space-y-3' role='alert'>
					<p>{t("loadFailed")}</p>
					<Button onClick={() => query.refetch()} variant='outline'>
						{t("retry")}
					</Button>
				</div>
			)}
			{query.isSuccess && messages.length === 0 && (
				<p className='text-sm text-muted-foreground'>{t("noMessages")}</p>
			)}
			{messages.length > 0 && (
				<div className='grid gap-2'>
					<div className='flex justify-between px-3 text-xs text-muted-foreground'>
						<span>{t("message")}</span>
						<span>{t("messageDate")}</span>
					</div>
					<ul className='grid gap-1'>
						{messages.map((message) => (
							<li key={message.id}>
								<button
									className='flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
									onClick={() => onMessageChange(message.id)}
									type='button'
								>
									<HugeiconsIcon
										aria-hidden
										className='size-4 shrink-0 scale-110 text-muted-foreground'
										icon={Message01Icon}
										strokeWidth={1.75}
									/>
									<span className='min-w-0 flex-1 truncate' dir='auto'>
										{message.message}
									</span>
									<time
										className='shrink-0 text-xs text-muted-foreground'
										dateTime={message.createdAt}
									>
										{format.dateTime(new Date(message.createdAt), { dateStyle: "medium" })}
									</time>
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
			{query.hasNextPage && (
				<Button
					className='mt-5'
					loading={query.isFetchingNextPage}
					onClick={() => query.fetchNextPage()}
					variant='outline'
				>
					{t("moreMessages")}
				</Button>
			)}
			<DashboardDrawer
				closeLabel={t("close")}
				onOpenChange={(open) => !open && onMessageChange(null)}
				open={Boolean(messageId)}
			>
				<DashboardDrawerHeader
					description={
						detail.data ? (
							<time dateTime={detail.data.createdAt}>
								{format.dateTime(new Date(detail.data.createdAt), {
									dateStyle: "medium",
									timeStyle: "short",
								})}
							</time>
						) : (
							t("messageDetails")
						)
					}
					leading={<HugeiconsIcon className='size-6 scale-110' icon={Message01Icon} strokeWidth={1.75} />}
					title={detail.data?.senderName || t("message")}
				>
					{detail.data?.triagedAt && <ContactMessageBadges message={detail.data} />}
				</DashboardDrawerHeader>
				<DrawerPanel allowSelection={false} padding='spacious' scrollFade={false}>
					{detail.isPending && <Skeleton aria-label={t("loading")} className='h-24 w-full' role='status' />}
					{detail.isError && (
						<div className='space-y-3' role='alert'>
							<p>{t("loadFailed")}</p>
							<Button onClick={() => detail.refetch()} variant='outline'>
								{t("retry")}
							</Button>
						</div>
					)}
					{detail.data && (
						<div className='grid gap-5 pb-10 text-sm'>
							<Frame aria-label={t("message")} role='region'>
								<DashboardFrameHeader icon={Message01Icon} title={t("message")} />
								<FramePanel>
									<p className='whitespace-pre-wrap break-words leading-relaxed' dir='auto'>
										{detail.data.message}
									</p>
								</FramePanel>
							</Frame>
							{!detail.data.triagedAt && can("workspace.write") && (
								<ContactMessageTriage contactId={contactId} messageId={detail.data.id} />
							)}
						</div>
					)}
				</DrawerPanel>
			</DashboardDrawer>
		</>
	);
};
