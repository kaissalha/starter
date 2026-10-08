"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import dynamic from "next/dynamic";
import Image from "next/image";

import { Message01Icon, BrushCleaningIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

import { ChatContent } from "@/components/chat/chat-content";
import {
	ChatSessionProvider,
	selectChatSessionBusy,
	useChatSession,
} from "@/components/chat/stores/chat-session-store";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient, client } from "@/lib/api-client";
import { getReadableTextColor } from "@/utils/get-readable-text-color";
import { brandColorNames, getBrandFont } from "@starter/infinite-brand";
import { resolveLocalizedPageSlug } from "@starter/infinite-website";
import type { WebsiteSnapshotV1, WebsiteStateV1 } from "@starter/infinite-website/contracts";
import type { DashboardChatUIMessage, WebsiteEditorBinding } from "@starter/server";
import { Button } from "@starter/ui/components/button";
import { Sidebar, useSidebar } from "@starter/ui/components/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@starter/ui/components/tabs";
import { cn } from "@starter/ui/lib/utils";

import { EditorDesignList, EditorDesignRow } from "../../components/editor/editor-design-list";
import { EditorSheetClose } from "../../components/editor/editor-sheet-close";
import { useWebsiteGenerationStore } from "../generation/website-generation-store";
import type { WebsiteEditor, WebsiteSidebarMode } from "../use-website-editor";
import { WebsiteBrandCustomizePanel, type WebsiteBrandCustomizeSection } from "./website-brand-customize-panel";
import { WebsiteLayoutPanel } from "./website-layout-panel";
import { WebsiteMediaPanel } from "./website-media-panel";

const WebsiteTemplateSelectorFallback = () => {
	const t = useTranslations("website.templates");

	return (
		<div aria-label={t("loading")} className='shimmer-container flex h-full min-h-0 flex-col' role='status'>
			<div className='flex items-center gap-2 px-4 pt-4 pb-2'>
				<span className='shimmer shimmer-bg -ms-2 size-8 rounded-lg bg-muted/52' />
				<span className='shimmer shimmer-bg h-7 w-28 rounded bg-muted/72' />
			</div>
			<div className='min-h-0 flex-1 overflow-hidden p-4'>
				<div className='grid gap-3'>
					{["first", "second"].map((item) => (
						<span
							className='shimmer shimmer-bg block aspect-video rounded-xl bg-background smooth-shadow-xs'
							key={item}
						/>
					))}
				</div>
			</div>
		</div>
	);
};

const WebsiteSectionCatalogFallback = () => {
	const t = useTranslations("website.sectionCatalog");

	return (
		<div aria-label={t("loading")} className='shimmer-container flex h-full min-h-0 flex-col' role='status'>
			<div className='border-b border-sidebar-border px-4 py-3'>
				<div className='shimmer shimmer-bg h-5 w-36 rounded bg-muted/72' />
				<div className='shimmer shimmer-bg mt-2 h-3 w-52 rounded bg-muted/52' />
			</div>
			<div className='min-h-0 flex-1 p-4'>
				<div className='shimmer shimmer-bg h-9 rounded-xl bg-background' />
				<div className='mt-4 flex gap-2'>
					<div className='shimmer shimmer-bg h-7 w-16 rounded-lg bg-muted/52' />
					<div className='shimmer shimmer-bg h-7 w-20 rounded-lg bg-muted/52' />
				</div>
				<div className='shimmer shimmer-bg mt-4 h-56 rounded-xl bg-background' />
			</div>
		</div>
	);
};

const WebsiteSectionCatalogPanel = dynamic(
	async () => (await import("./website-section-catalog")).WebsiteSectionCatalogPanel,
	{ loading: WebsiteSectionCatalogFallback }
);

const WebsiteTemplatePreview = dynamic(
	async () => (await import("./website-template-selector")).WebsiteTemplatePreview,
	{ loading: () => <span className='shimmer shimmer-bg block size-full bg-muted/52' /> }
);

const WebsiteTemplateSelector = dynamic(
	async () => (await import("./website-template-selector")).WebsiteTemplateSelector,
	{ loading: WebsiteTemplateSelectorFallback }
);

type WebsiteReconciliationScope = {
	active: boolean;
	queue: Promise<void>;
	request: number;
	websiteId: string;
};

export const WebsiteEditorAgentProvider = ({
	chatId,
	children,
	initialMessages,
	locale,
	onReconciliationPendingChange,
	sectionId,
	snapshot,
	websiteId,
}: {
	chatId: string;
	children: ReactNode;
	initialMessages: Array<DashboardChatUIMessage>;
	locale: WebsiteEditorBinding["locale"];
	onReconciliationPendingChange?: (pending: boolean) => void;
	sectionId?: string;
	snapshot: WebsiteSnapshotV1;
	websiteId: string;
}) => {
	const queryClient = useQueryClient();
	const pageId = useWebsiteGenerationStore((state) => state.pageId);
	const [reconciliation, setReconciliation] = useState({ pending: false, websiteId });
	const reconciliationScope = useRef<WebsiteReconciliationScope | null>(null);
	const reconciliationPending = reconciliation.websiteId !== websiteId || reconciliation.pending;

	useEffect(() => {
		onReconciliationPendingChange?.(reconciliationPending);
	}, [onReconciliationPendingChange, reconciliationPending]);

	const pageSlug = useMemo(() => {
		if (!pageId || !snapshot.document.structure.pages.some((page) => page.id === pageId)) {
			return undefined;
		}

		return resolveLocalizedPageSlug({
			content: snapshot.document.content,
			defaultLocale: snapshot.document.defaultLocale,
			locale,
			pageId,
		});
	}, [locale, pageId, snapshot.document]);

	const websiteEditor = useMemo(
		() => ({ locale, pageSlug, sectionId, websiteId }),
		[websiteId, locale, pageSlug, sectionId]
	) satisfies WebsiteEditorBinding;

	const reconcileWebsite = useCallback(
		(scope: WebsiteReconciliationScope) => {
			const request = ++scope.request;

			const pending = (async () => {
				try {
					await scope.queue;
				} catch {}

				try {
					const queryKey = apiClient.websites.get.queryKey();
					const fetched = await client.websites.get();

					if (!scope.active || (fetched && fetched.id !== scope.websiteId)) {
						return;
					}

					const cached = queryClient.getQueryData<WebsiteStateV1 | null>(queryKey);

					if (cached && cached.id !== scope.websiteId && !fetched) {
						return;
					}

					const website =
						cached &&
						fetched &&
						cached.id === fetched.id &&
						Date.parse(cached.updatedAt) >= Date.parse(fetched.updatedAt)
							? cached
							: fetched;

					if (website !== cached) {
						queryClient.setQueryData(queryKey, website);
					}

					if (website?.snapshot && !website.workflow) {
						useWebsiteGenerationStore
							.getState()
							.recover({ snapshot: website.snapshot, websiteId: website.id });
					}
				} catch {}
			})();

			scope.queue = pending;

			(async () => {
				await pending;

				if (scope.active && reconciliationScope.current === scope && scope.request === request) {
					setReconciliation({ pending: false, websiteId: scope.websiteId });
				}
			})();
		},
		[queryClient]
	);

	useEffect(() => {
		const scope: WebsiteReconciliationScope = {
			active: true,
			queue: Promise.resolve(),
			request: 0,
			websiteId,
		};

		reconciliationScope.current = scope;
		reconcileWebsite(scope);

		return () => {
			scope.active = false;

			if (reconciliationScope.current === scope) {
				reconciliationScope.current = null;
			}
		};
	}, [reconcileWebsite, websiteId]);

	const handleWebsiteChange = useCallback(() => {
		const scope = reconciliationScope.current;

		if (scope?.active && scope.websiteId === websiteId) {
			setReconciliation({ pending: true, websiteId });
			reconcileWebsite(scope);
		}
	}, [reconcileWebsite, websiteId]);

	return (
		<ChatSessionProvider
			initialMessages={initialMessages}
			runtime={{ chatId, onDataChange: { website: handleWebsiteChange }, websiteEditor }}
		>
			{children}
		</ChatSessionProvider>
	);
};

const WebsiteAgentEmptyState = () => {
	const t = useTranslations("website.sidebar");

	return (
		<div className='max-w-sm px-8 pb-24 text-center'>
			<h2 className='text-lg font-medium'>{t("agentTitle")}</h2>
			<p className='mt-2 text-sm leading-relaxed text-muted-foreground'>{t("agentDescription")}</p>
		</div>
	);
};

const websiteDesignCornerClassName = {
	rounded: "rounded-lg",
	soft: "rounded-full",
	square: "rounded-none",
	subtle: "rounded-sm",
} as const;

const WebsiteSettingsRow = () => {
	const t = useTranslations("website.settings");
	const [, setSettingsTab] = useQueryState("websiteSettings");
	const { setOpenMobile } = useSidebar("details");

	return (
		<li className='md:hidden'>
			<Button
				className='w-full'
				onClick={() => {
					setOpenMobile(false);
					setSettingsTab("list");
				}}
				variant='outline'
			>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Settings01Icon} strokeWidth={1.75} />
				{t("title")}
			</Button>
		</li>
	);
};

const WebsitePagePanel = ({
	editor,
	onOpenCustomize,
	onOpenTemplates,
	snapshot,
}: {
	editor: WebsiteEditor;
	onOpenCustomize: (section: WebsiteBrandCustomizeSection) => void;
	onOpenTemplates: () => void;
	snapshot: WebsiteSnapshotV1;
}) => {
	const t = useTranslations("website");
	const { can } = useOrganizationPermissions();
	const templates = useQuery(apiClient.websites.templates.queryOptions({ staleTime: Number.POSITIVE_INFINITY }));
	const controlsDisabled = editor.disabled || editor.pending !== null;
	const headingFont = getBrandFont({ fontId: snapshot.brand.typography.heading.default.fontId });
	const bodyFont = getBrandFont({ fontId: snapshot.brand.typography.body.default.fontId });
	const fontName = (family?: string) => family?.replace(" Variable", "");
	const { content, defaultLocale } = snapshot.document;
	const siteName = content[editor.locale]?.site.name ?? content[defaultLocale]?.site.name;

	return (
		<EditorDesignList title={t("sidebar.pageTitle")}>
			<EditorDesignRow
				disabled={controlsDisabled || !can("workspace.delete")}
				onClick={onOpenTemplates}
				preview={<WebsiteTemplatePreview locale={editor.locale} snapshot={snapshot} />}
				title={t("templates.title")}
				value={templates.data?.find((template) => template.id === snapshot.templateId)?.name}
			/>
			<EditorDesignRow
				disabled={controlsDisabled}
				onClick={() => onOpenCustomize("logo")}
				preview={
					snapshot.brand.logo ? (
						<Image
							alt=''
							className='h-10 w-auto max-w-[80%] object-contain'
							height={40}
							src={snapshot.brand.logo.src}
							unoptimized
							width={160}
						/>
					) : (
						<span
							className='truncate px-4 text-xl font-semibold'
							style={{ fontFamily: headingFont?.family }}
						>
							{siteName}
						</span>
					)
				}
				title={t("customize.logo.title")}
			/>
			<EditorDesignRow
				disabled={controlsDisabled}
				onClick={() => onOpenCustomize("palette")}
				preview={
					<span className='flex size-full gap-1.5 p-3'>
						{brandColorNames.map((colorName) => (
							<span
								className='flex-1 rounded-lg outline outline-1 -outline-offset-1 outline-foreground/12'
								key={colorName}
								style={{ backgroundColor: snapshot.brand.colors[colorName] }}
							/>
						))}
					</span>
				}
				title={t("customize.palette.title")}
			/>
			<EditorDesignRow
				disabled={controlsDisabled}
				onClick={() => onOpenCustomize("fonts")}
				preview={
					<span className='grid max-w-full gap-1 px-4 text-center'>
						<span className='truncate text-2xl font-semibold' style={{ fontFamily: headingFont?.family }}>
							{fontName(headingFont?.family)}
						</span>
						<span
							className='truncate text-sm text-muted-foreground'
							style={{ fontFamily: bodyFont?.family }}
						>
							{fontName(bodyFont?.family)}
						</span>
					</span>
				}
				title={t("customize.fonts.title")}
			/>
			<EditorDesignRow
				disabled={controlsDisabled}
				onClick={() => onOpenCustomize("corners")}
				preview={
					<span
						className={cn(
							"inline-flex h-9 items-center px-5 text-sm font-medium",
							websiteDesignCornerClassName[snapshot.brand.corners.style]
						)}
						style={{
							backgroundColor: snapshot.brand.colors.primary,
							color: getReadableTextColor({ color: snapshot.brand.colors.primary }),
						}}
					>
						{t("customize.corners.preview")}
					</span>
				}
				title={t("customize.corners.title")}
				value={t(`customize.corners.options.${snapshot.brand.corners.style}`)}
			/>
			<WebsiteSettingsRow />
		</EditorDesignList>
	);
};

type WebsiteEditorSidebarProps = {
	agentFocusRequest: number;
	editor: WebsiteEditor;
	onAddSection: (input: { index: number; pageId: string; pattern: string }) => Promise<void>;
	onBusyChange?: (busy: boolean) => void;
	onChangeTemplate: (input: { templateId: string }) => Promise<void>;
	onGenerateLayout: Parameters<typeof WebsiteLayoutPanel>[0]["onGenerate"];
	snapshot: WebsiteSnapshotV1;
	websiteId: string;
};

const WebsiteEditorSidebarContent = ({
	agentBusy,
	agentContent,
	agentFocusRequest,
	editor,
	onAddSection,
	onChangeTemplate,
	onGenerateLayout,
	snapshot,
	websiteId,
}: Omit<WebsiteEditorSidebarProps, "onBusyChange"> & { agentBusy: boolean; agentContent: ReactNode }) => {
	const t = useTranslations("website.sidebar");
	useQuery({
		...apiClient.websites.templates.queryOptions({ staleTime: Number.POSITIVE_INFINITY }),
		enabled: editor.sidebarMode === "page",
	});
	const catalogTarget = useWebsiteGenerationStore((state) => state.catalogTarget);
	const [customizeSection, setCustomizeSection] = useState<WebsiteBrandCustomizeSection>("palette");

	const manualFlowActive =
		(editor.overlay !== null && editor.overlay !== "media") || catalogTarget !== null || editor.pending !== null;

	const agentPanel = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (agentFocusRequest === 0 || editor.sidebarMode !== "agent") {
			return;
		}

		const frame = requestAnimationFrame(() => {
			agentPanel.current
				?.querySelector<HTMLTextAreaElement>("textarea:not(:disabled)")
				?.focus({ preventScroll: true });
		});

		return () => cancelAnimationFrame(frame);
	}, [agentFocusRequest, editor.sidebarMode]);

	const setSidebarMode = (value: string) => {
		if (value === "agent" || value === "page") {
			if (editor.overlay === "media") {
				editor.closeDraft();
			}

			const sidebarMode: WebsiteSidebarMode = value;
			editor.setState({ sidebarMode });
		}
	};

	const openCustomize = (section: WebsiteBrandCustomizeSection) => {
		setCustomizeSection(section);
		editor.openOverlay({ kind: "customize" });
	};

	const openTemplates = () => editor.openOverlay({ kind: "templates" });

	const dismiss = () => {
		if (catalogTarget) {
			useWebsiteGenerationStore.getState().closeCatalog();
		}

		if (editor.overlay === "media") {
			editor.closeDraft();
		} else if (editor.overlay) {
			editor.cancelDraft();
		}
	};

	const pageContent = (() => {
		if (catalogTarget) {
			return <WebsiteSectionCatalogPanel onSelect={onAddSection} snapshot={snapshot} websiteId={websiteId} />;
		}

		if (editor.overlay === "media" && editor.mediaTarget) {
			return (
				<WebsiteMediaPanel
					editor={editor}
					key={`${editor.mediaTarget.sectionId}:${editor.mediaTarget.pointer ?? ""}`}
					target={editor.mediaTarget}
				/>
			);
		}

		if (editor.overlay === "layout") {
			return <WebsiteLayoutPanel editor={editor} onGenerate={onGenerateLayout} websiteId={websiteId} />;
		}

		if (editor.overlay === "customize") {
			return <WebsiteBrandCustomizePanel editor={editor} section={customizeSection} />;
		}

		if (editor.overlay === "templates") {
			return (
				<WebsiteTemplateSelector
					locale={editor.locale}
					onApply={async (templateId) => {
						await onChangeTemplate({ templateId });
						editor.closeDraft();
					}}
					onCancel={editor.cancelDraft}
					onPreview={(previewSnapshot) =>
						editor.previewDraft({
							input: null,
							selection: previewSnapshot.templateId,
							snapshot: previewSnapshot,
						})
					}
					snapshot={snapshot}
					websiteId={websiteId}
				/>
			);
		}

		return (
			<WebsitePagePanel
				editor={editor}
				onOpenCustomize={openCustomize}
				onOpenTemplates={openTemplates}
				snapshot={snapshot}
			/>
		);
	})();

	return (
		<Sidebar
			aria-label={t("customize")}
			border='none'
			className='overflow-hidden max-md:h-[min(34rem,56dvh)]'
			mobileModal={false}
			mobilePeek={{
				height: "4.75rem",
				label: t("togglePreview"),
				resetKey: catalogTarget ? "catalog" : (editor.overlay ?? editor.sidebarMode),
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
				onValueChange={setSidebarMode}
				spacing='none'
				value={editor.sidebarMode}
			>
				<div
					className={cn(
						"flex shrink-0 items-center gap-2 p-2.5 max-md:pt-1.5",
						(editor.overlay || catalogTarget) && "max-md:hidden"
					)}
				>
					<TabsList className='flex-1 grid-cols-2' variant='toggle'>
						<TabsTrigger
							disabled={agentBusy}
							onClick={editor.overlay === "media" ? editor.closeDraft : undefined}
							value='page'
						>
							<HugeiconsIcon
								aria-hidden='true'
								className='size-4 scale-110'
								icon={BrushCleaningIcon}
								strokeWidth={1.75}
							/>
							{t("page")}
						</TabsTrigger>
						<TabsTrigger disabled={manualFlowActive} value='agent'>
							<HugeiconsIcon
								aria-hidden='true'
								className='size-4 scale-110'
								icon={Message01Icon}
								strokeWidth={1.75}
							/>
							{t("agent")}
						</TabsTrigger>
					</TabsList>
					<EditorSheetClose onClose={dismiss} />
				</div>
				<TabsContent animated className='flex min-h-0 flex-1 flex-col' ref={agentPanel} value='agent'>
					{agentContent}
				</TabsContent>
				<TabsContent animated className='flex min-h-0 flex-1 flex-col' value='page'>
					{pageContent}
				</TabsContent>
			</Tabs>
		</Sidebar>
	);
};

export const WebsiteEditorSidebar = ({ onBusyChange, ...props }: WebsiteEditorSidebarProps) => {
	const t = useTranslations("website.sidebar");
	const agentBusy = useChatSession(selectChatSessionBusy);

	useEffect(() => {
		onBusyChange?.(agentBusy);
	}, [agentBusy, onBusyChange]);

	return (
		<WebsiteEditorSidebarContent
			{...props}
			agentBusy={agentBusy}
			agentContent={
				<ChatContent
					composerAreaClassName='px-2 pb-[max(.5rem,env(safe-area-inset-bottom))]'
					composerClassName='[&_[data-slot=chat-input]]:rounded-[24px] [&_[data-slot=chat-input]]:smooth-shadow-ring-md [&_[data-slot=chat-input-body]]:p-3 [&_[data-slot=chat-input-textarea]]:flex'
					emptyState={<WebsiteAgentEmptyState />}
					messageClassName='md:px-4'
					placeholder={t("agentPlaceholder")}
				/>
			}
		/>
	);
};

const WebsiteAgentPanelState = ({ error, onRetry }: { error?: boolean; onRetry?: () => void }) => {
	const tCommon = useTranslations("common");

	if (error) {
		return (
			<div className='flex h-full items-center justify-center p-6' role='alert'>
				<div className='max-w-xs text-center'>
					<p className='text-sm text-muted-foreground'>{tCommon("messages.somethingWentWrong")}</p>
					<Button className='mt-3' onClick={onRetry} size='sm' variant='outline'>
						{tCommon("retry")}
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div
			aria-label={tCommon("loading")}
			className='shimmer-container flex h-full flex-col p-3 pt-0'
			data-testid='website-agent-loading'
			role='status'
		>
			<div className='flex flex-1 flex-col items-center justify-center gap-2 pb-24'>
				<div className='shimmer shimmer-bg h-4 w-40 rounded bg-muted/72' />
				<div className='shimmer shimmer-bg h-3 w-52 rounded bg-muted/52' />
				<div className='shimmer shimmer-bg h-3 w-44 rounded bg-muted/52' />
			</div>
			<div className='shimmer shimmer-bg h-24 rounded-2xl bg-muted/40' />
		</div>
	);
};

export const WebsiteEditorAgentSidebar = ({
	locale,
	onLockChange,
	sectionId,
	snapshot,
	websiteId,
	...sidebarProps
}: Omit<WebsiteEditorSidebarProps, "onBusyChange" | "snapshot" | "websiteId"> & {
	locale: WebsiteEditorBinding["locale"];
	onLockChange: (locked: boolean) => void;
	sectionId?: string;
	snapshot: WebsiteSnapshotV1;
	websiteId: string;
}) => {
	const agentChatQuery = useQuery(apiClient.websites.agentChat.queryOptions());
	const [agentBusy, setAgentBusy] = useState(false);
	const [reconciliationPending, setReconciliationPending] = useState(false);
	const locked = agentChatQuery.isSuccess && (agentBusy || reconciliationPending);

	useEffect(() => {
		onLockChange(locked);
	}, [locked, onLockChange]);

	if (agentChatQuery.isLoading) {
		return (
			<WebsiteEditorSidebarContent
				{...sidebarProps}
				agentBusy={false}
				agentContent={<WebsiteAgentPanelState />}
				snapshot={snapshot}
				websiteId={websiteId}
			/>
		);
	}

	if (agentChatQuery.isError || !agentChatQuery.data) {
		return (
			<WebsiteEditorSidebarContent
				{...sidebarProps}
				agentBusy={false}
				agentContent={<WebsiteAgentPanelState error onRetry={() => agentChatQuery.refetch()} />}
				snapshot={snapshot}
				websiteId={websiteId}
			/>
		);
	}

	return (
		<WebsiteEditorAgentProvider
			chatId={agentChatQuery.data.chatId}
			initialMessages={agentChatQuery.data.messages}
			locale={locale}
			onReconciliationPendingChange={setReconciliationPending}
			sectionId={sectionId}
			snapshot={snapshot}
			websiteId={websiteId}
		>
			<WebsiteEditorSidebar
				{...sidebarProps}
				onBusyChange={setAgentBusy}
				snapshot={snapshot}
				websiteId={websiteId}
			/>
		</WebsiteEditorAgentProvider>
	);
};
