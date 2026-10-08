"use client";

import { type ReactNode } from "react";

import { BrushCleaningIcon, Message01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { EditorSheetClose } from "@/app/[locale]/dashboard/components/editor/editor-sheet-close";
import { ChatContent } from "@/components/chat/chat-content";
import {
	ChatSessionProvider,
	selectChatSessionBusy,
	useChatSession,
} from "@/components/chat/stores/chat-session-store";
import { apiClient } from "@/lib/api-client";
import { Button } from "@starter/ui/components/button";
import { Sidebar } from "@starter/ui/components/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@starter/ui/components/tabs";
import { cn } from "@starter/ui/lib/utils";

import { LinksContentEditor } from "./links-content-editor";
import { LinksDesignEditor } from "./links-design-editor";
import type { LinksPageController } from "./use-links-page-controller";

const LinksSidebarContent = ({
	agentBusy = false,
	agentContent,
	controller,
	onPage,
}: {
	agentBusy?: boolean;
	agentContent: ReactNode;
	controller: LinksPageController;
	onPage: () => void;
}) => {
	const t = useTranslations("website.sidebar");

	const contextual =
		controller.view.kind === "add-block" ||
		controller.view.kind === "add-social" ||
		controller.view.kind === "block";

	const agentActive = controller.view.kind === "agent";

	const dismiss = () => {
		if (controller.view.kind !== "root" && controller.view.kind !== "agent") {
			controller.setView({ kind: "root" });
		}
	};

	return (
		<Sidebar
			aria-label={t("customize")}
			border='none'
			className='overflow-clip max-md:h-[min(34rem,56dvh)]'
			mobileModal={false}
			mobilePeek={{
				height: "4.75rem",
				label: t("togglePreview"),
				resetKey:
					"id" in controller.view ? `${controller.view.kind}:${controller.view.id}` : controller.view.kind,
			}}
			mobilePosition='bottom'
			onMobileOpenChange={(open) => {
				if (!open) {
					dismiss();
				}
			}}
			purpose='details'
			surface='sidebar'
		>
			<Tabs
				className='flex h-full min-h-0 flex-col'
				onValueChange={(value) => {
					if (value === "agent") {
						controller.setView({ kind: "agent" });
					} else {
						onPage();
					}
				}}
				spacing='none'
				value={agentActive ? "agent" : "page"}
			>
				<div
					className={cn(
						"flex shrink-0 items-center gap-2 p-2.5 max-md:pt-1.5",
						!agentActive && controller.view.kind !== "root" && "max-md:hidden"
					)}
				>
					<TabsList className='flex-1 grid-cols-2' variant='toggle'>
						{(["page", "agent"] as const).map((tab) => (
							<TabsTrigger
								disabled={
									tab === "page"
										? agentBusy
										: !controller.can("workspace.write") ||
											controller.dirty ||
											controller.saving ||
											controller.publishing ||
											(!agentActive && controller.view.kind !== "root")
								}
								key={tab}
								value={tab}
							>
								<HugeiconsIcon
									aria-hidden='true'
									className='size-4 scale-110'
									icon={tab === "page" ? BrushCleaningIcon : Message01Icon}
									strokeWidth={1.75}
								/>
								{t(tab)}
							</TabsTrigger>
						))}
					</TabsList>
					<EditorSheetClose onClose={dismiss} />
				</div>
				<TabsContent animated className='flex min-h-0 flex-1 flex-col' value='agent'>
					{agentContent}
				</TabsContent>
				<TabsContent animated className='flex min-h-0 flex-1 flex-col' value='page'>
					{contextual ? (
						<LinksContentEditor controller={controller} />
					) : (
						<LinksDesignEditor controller={controller} />
					)}
				</TabsContent>
			</Tabs>
		</Sidebar>
	);
};

const LinksAgentSidebar = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.agent");
	const busy = useChatSession(selectChatSessionBusy);
	const refresh = useMutation({ mutationFn: controller.refresh });
	const tCommon = useTranslations("common");

	return (
		<LinksSidebarContent
			agentBusy={busy || refresh.isPending}
			agentContent={
				<>
					{refresh.data === false && (
						<p className='px-4 py-2 text-sm text-destructive' role='alert'>
							{tCommon("messages.somethingWentWrong")}
						</p>
					)}
					<ChatContent
						composerAreaClassName='px-2 pb-[max(.5rem,env(safe-area-inset-bottom))]'
						composerClassName='[&_[data-slot=chat-input]]:rounded-[24px] [&_[data-slot=chat-input]]:smooth-shadow-ring-md [&_[data-slot=chat-input-body]]:p-3 [&_[data-slot=chat-input-textarea]]:flex'
						emptyState={
							<div className='max-w-sm px-8 pb-24 text-center'>
								<h2 className='text-lg font-medium'>{t("agentTitle")}</h2>
								<p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
									{t("agentDescription")}
								</p>
							</div>
						}
						messageClassName='md:px-4'
						placeholder={t("agentPlaceholder")}
					/>
				</>
			}
			controller={controller}
			onPage={async () => {
				if (await refresh.mutateAsync()) {
					controller.setView({ kind: "root" });
				}
			}}
		/>
	);
};

export const LinksEditorSidebar = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("common");
	const active = controller.view.kind === "agent";
	const query = useQuery({ ...apiClient.linkPages.agentChat.queryOptions(), enabled: active });

	if (!query.data) {
		return (
			<LinksSidebarContent
				agentContent={
					<div
						className='flex h-full flex-col items-center justify-center gap-3 p-6'
						role={query.isError ? "alert" : "status"}
					>
						<p className='text-sm text-muted-foreground'>
							{query.isError ? t("messages.somethingWentWrong") : t("loading")}
						</p>
						{query.isError && (
							<Button onClick={() => query.refetch()} size='sm' variant='outline'>
								{t("retry")}
							</Button>
						)}
					</div>
				}
				controller={controller}
				onPage={() => controller.setView({ kind: "root" })}
			/>
		);
	}

	return (
		<ChatSessionProvider
			initialMessages={query.data.messages}
			key={query.data.chatId}
			runtime={{
				chatId: query.data.chatId,
				linksEditor: true,
				onDataChange: {
					links: () => {
						if (controller.view.kind === "agent") {
							controller.refresh();
						}
					},
				},
			}}
		>
			<LinksAgentSidebar controller={controller} />
		</ChatSessionProvider>
	);
};
