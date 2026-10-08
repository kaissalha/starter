"use client";

import { useEffect, useState, type ReactNode } from "react";

import { useSearchParams } from "next/navigation";

import { useLocale, useTranslations } from "next-intl";

import { WebsiteSettingsModal } from "@/app/[locale]/dashboard/components/editor/website-settings-modal";
import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { getWebsiteUrl } from "@/utils/get-website-url";
import { websiteGenerationLocales, type WebsiteStateV1 } from "@starter/infinite-website/generation";
import { Button } from "@starter/ui/components/button";
import { type CSSPropertiesWithVariables, SidebarProvider, useSidebar } from "@starter/ui/components/sidebar";
import { getDirection } from "@starter/utils";

import { EditorCustomizeButton } from "../components/editor/editor-customize-button";
import { EditorLanguageSelect } from "../components/editor/editor-language-select";
import { EditorModeSwitch } from "../components/editor/editor-mode-switch";
import { EditorPublishPopover } from "../components/editor/editor-publish-popover";
import { EditorViewportToggle } from "../components/editor/editor-viewport-toggle";
import { revealInScrollArea } from "../components/editor/reveal-in-scroll-area";
import { useEditorSidebar } from "../components/editor/use-editor-sidebar";
import { WebsiteEditorAgentSidebar } from "./editor/website-editor-sidebar";
import { WebsiteGenerationPreview } from "./editor/website-generation-preview";
import { useWebsiteGenerationController } from "./generation/use-website-generation-controller";
import { useWebsiteGenerationStore } from "./generation/website-generation-store";
import { useWebsitePublicUrl } from "./use-website-domains-controller";
import { useWebsiteEditor, type WebsiteEditor, type WebsiteMode } from "./use-website-editor";
import { WebsiteDomainsPanel } from "./website-domains-panel";
import { WebsitePageSelect } from "./website-page-select";

const websiteViewports = ["desktop", "tablet", "mobile"] as const;

const websiteEditorSidebarStyle = {
	"--sidebar-width-details": "23rem",
} satisfies CSSPropertiesWithVariables;

const WebsiteModeSwitch = ({
	disabled = false,
	mode,
	onModeChange,
}: {
	disabled?: boolean;
	mode: WebsiteMode;
	onModeChange: (mode: WebsiteMode) => void;
}) => {
	const { can } = useOrganizationPermissions();
	const t = useTranslations("website.modes");

	return (
		<EditorModeSwitch
			aria-label={t("preview")}
			checked={mode === "preview"}
			disabled={disabled || !can("workspace.write")}
			onCheckedChange={(checked) => onModeChange(checked ? "preview" : "edit")}
		/>
	);
};

const WebsiteEditorHeaderActions = ({
	editor,
	locked,
	onPublish,
	publication,
	publishing,
	websitesUrl,
}: {
	editor: WebsiteEditor;
	locked: boolean;
	onPublish: () => void;
	publication?: WebsiteStateV1["publication"];
	publishing: boolean;
	websitesUrl?: string;
}) => {
	const { isMobile, setOpen, setOpenMobile } = useSidebar("details");

	return (
		<>
			<WebsiteSettingsModal
				disabled={locked || editor.disabled}
				publicUrl={websitesUrl}
				showTrigger={!isMobile}
			/>
			<WebsiteModeSwitch
				disabled={locked}
				mode={editor.mode}
				onModeChange={(mode) => {
					if (mode === "preview") {
						setOpen(false);
						setOpenMobile(false);
					}

					if (editor.overlay === "media") {
						editor.closeDraft();
					}

					editor.setState(mode === "preview" ? { mode, viewport: "desktop" } : { mode });
				}}
			/>
			<EditorPublishPopover
				disabled={editor.disabled}
				kind='website'
				onPublish={onPublish}
				publication={publication}
				publicUrl={websitesUrl}
				publishing={publishing}
			>
				<WebsiteDomainsPanel publicUrl={websitesUrl} />
			</EditorPublishPopover>
		</>
	);
};

const WebsiteHeader = ({
	actions,
	center,
	centerClassName = "hidden md:flex",
	leading,
}: {
	actions?: ReactNode;
	center?: ReactNode;
	centerClassName?: string;
	leading?: ReactNode;
}) => {
	return (
		<Header
			actions={actions}
			center={center}
			centerClassName={centerClassName}
			className='gap-x-1.5 px-2 py-1.5 sm:px-3 sm:py-2 md:px-3'
			item={{ labelTx: "website" }}
			leading={leading ?? null}
		/>
	);
};

export const WebsiteLoadingState = () => {
	const t = useTranslations("website");

	return (
		<div
			aria-label={t("loading")}
			className='flex min-h-0 flex-1 overflow-hidden bg-background'
			data-testid='website-editor-loading'
			role='status'
		>
			<div className='shimmer-container flex min-h-0 flex-1'>
				<div className='min-h-0 flex-1 md:px-2 md:pb-2' data-testid='website-canvas-loading'>
					<div className='@container h-full w-full overflow-hidden rounded-none bg-background md:rounded-2xl md:border md:border-border'>
						<div className='flex h-16 items-center justify-between border-b border-border/48 px-6'>
							<div className='shimmer shimmer-bg h-3 w-24 bg-muted/72' />
							<div className='flex gap-3'>
								<div className='shimmer shimmer-bg h-3 w-16 bg-muted/52' />
								<div className='shimmer shimmer-bg h-3 w-16 bg-muted/52' />
								<div className='shimmer shimmer-bg h-3 w-16 bg-muted/52' />
							</div>
						</div>
						<div className='flex min-h-96 flex-col justify-end bg-muted/32 p-8 md:p-12'>
							<div className='shimmer shimmer-bg h-4 w-[min(28cqi,9rem)] bg-muted/72' />
							<div className='shimmer shimmer-bg mt-5 h-8 w-[min(84cqi,40rem)] bg-muted/72' />
							<div className='shimmer shimmer-bg mt-3 h-4 w-[min(92cqi,48rem)] bg-muted/52' />
							<div className='shimmer shimmer-bg mt-2 h-4 w-[min(68cqi,36rem)] bg-muted/52' />
						</div>
						<div className='grid gap-px border-y border-border/48 bg-border/48 md:grid-cols-3'>
							<div className='shimmer shimmer-bg h-48 bg-background' />
							<div className='shimmer shimmer-bg h-48 bg-background' />
							<div className='shimmer shimmer-bg h-48 bg-background' />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

const WebsiteInitialGenerationHeader = () => {
	const t = useTranslations("website");

	return (
		<WebsiteHeader
			actions={
				<>
					<WebsiteModeSwitch disabled mode='edit' onModeChange={() => undefined} />
					<Button aria-label={t("publish.open")} disabled size='sm'>
						{t("publish.mobile")}
					</Button>
				</>
			}
			center={
				<EditorViewportToggle
					disabled
					onViewportChange={() => undefined}
					viewport='desktop'
					viewports={websiteViewports}
				/>
			}
			leading={
				<EditorLanguageSelect disabled locale='en' locales={["en", "ar"]} onLocaleChange={() => undefined} />
			}
		/>
	);
};

const WebsiteGenerationFailure = ({
	blocked,
	onReconnect,
	recoverable,
}: {
	blocked: boolean;
	onReconnect: () => void;
	recoverable: boolean;
}) => {
	const t = useTranslations("website");

	if (blocked) {
		return (
			<div className='mx-auto max-w-xl px-5 pt-8 sm:px-8' role='alert'>
				<div className='border-s-2 border-destructive ps-4'>
					<p className='font-medium'>{t("blocked.title")}</p>
					<p className='mt-1 text-sm text-muted-foreground'>{t("blocked.description")}</p>
				</div>
			</div>
		);
	}

	const state = recoverable ? "disconnected" : "failed";

	return (
		<div className='mx-auto max-w-xl px-5 pt-8 sm:px-8' role='alert'>
			<div className='border-s-2 border-destructive ps-4'>
				<p className='font-medium'>{t(`${state}.title`)}</p>
				<p className='mt-1 text-sm text-muted-foreground'>{t(`${state}.description`)}</p>
				{recoverable && (
					<Button className='mt-3' onClick={onReconnect} size='sm' variant='outline'>
						{t("disconnected.action")}
					</Button>
				)}
			</div>
		</div>
	);
};

const WebsiteEditorShell = ({
	agentLocked,
	controller,
	editor,
	onAgentLockChange,
	publication,
	retryGeneration,
	snapshot,
	websiteId,
	websitesUrl,
}: {
	agentLocked: boolean;
	controller: ReturnType<typeof useWebsiteGenerationController>;
	editor: WebsiteEditor;
	onAgentLockChange: (locked: boolean) => void;
	publication?: WebsiteStateV1["publication"];
	retryGeneration: () => Promise<void>;
	snapshot: NonNullable<ReturnType<typeof useWebsiteGenerationController>["snapshot"]>;
	websiteId: string;
	websitesUrl?: string;
}) => {
	const { role } = useOrganizationPermissions();
	const { isMobile, openMobile, setOpen, setOpenMobile, state: sidebarState } = useSidebar("details");
	const catalogTarget = useWebsiteGenerationStore((state) => state.catalogTarget);
	const pageId = useWebsiteGenerationStore((state) => state.pageId);
	const navigate = useWebsiteGenerationStore((state) => state.navigate);
	const searchParams = useSearchParams();
	const router = useRouter();
	const requestedPage = searchParams.get("seoPage");
	const requestedLocale = searchParams.get("seoLocale");
	const [agentFocusRequest, setAgentFocusRequest] = useState(0);
	const [agentSectionId, setAgentSectionId] = useState<string>();

	useEffect(() => {
		if (!requestedPage || !snapshot.document.structure.pages.some((page) => page.id === requestedPage)) {
			return;
		}

		navigate({ pageId: requestedPage });
		const locale = snapshot.document.locales.find((value) => value === requestedLocale);

		if (locale) {
			editor.setState({ locale });
		}

		router.replace("/dashboard/website");
	}, [
		editor,
		navigate,
		requestedLocale,
		requestedPage,
		router,
		snapshot.document.locales,
		snapshot.document.structure.pages,
	]);

	const openDetails = (sectionId?: string) => {
		if (isMobile) {
			setOpenMobile(true, { closeOthers: true });
			requestAnimationFrame(() =>
				requestAnimationFrame(() =>
					revealInScrollArea(
						sectionId
							? globalThis.document.querySelector<HTMLElement>(`[data-website-section-id="${sectionId}"]`)
							: null
					)
				)
			);

			return;
		}

		setOpen(true);
	};

	const openPagePanel = (sectionId?: string) => {
		if (editor.overlay === "media") {
			editor.closeDraft();
		}

		editor.setState({ sidebarMode: "page" });
		openDetails(sectionId);
	};

	const openAgent = (sectionId?: string) => {
		if (editor.overlay === "media") {
			editor.closeDraft();
		}

		setAgentSectionId(sectionId);
		editor.setState({ sidebarMode: "agent" });
		setAgentFocusRequest((request) => request + 1);
		openDetails(sectionId);
	};

	const openOverlay = (request: Parameters<WebsiteEditor["openOverlay"]>[0]) => {
		openPagePanel("target" in request ? request.target.sectionId : undefined);
		editor.openOverlay(request);
	};

	const openSectionCatalog = ({ target }: { target: { index: number; pageId: string } }) => {
		openPagePanel();
		useWebsiteGenerationStore.getState().openCatalog({ target });
	};

	const sidebarEditor = {
		...editor,
		openOverlay,
	};

	const draftOverlayActive = editor.overlay !== null && editor.overlay !== "media";

	const canvasEditor = {
		...sidebarEditor,
		disabled: sidebarEditor.disabled || draftOverlayActive || catalogTarget !== null,
	};

	const initialGenerationActive =
		(controller.phase === "starting" || controller.phase === "streaming") &&
		!controller.additionActive &&
		!controller.layoutGenerationActive;

	const templatePreviewActive = editor.overlay === "templates";
	const customizeAction = <EditorCustomizeButton disabled={initialGenerationActive} isMobile={isMobile} />;

	const headerCenter: ReactNode =
		editor.mode === "preview" ? (
			<EditorViewportToggle
				disabled={initialGenerationActive}
				onViewportChange={(viewport) => editor.setState({ viewport })}
				viewport={editor.viewport}
				viewports={websiteViewports}
			/>
		) : (
			!isMobile && customizeAction
		);

	return (
		<>
			<div className='flex min-w-0 flex-1 flex-col'>
				<WebsiteHeader
					actions={
						<>
							{isMobile && editor.mode === "edit" && customizeAction}
							<WebsiteEditorHeaderActions
								editor={canvasEditor}
								locked={initialGenerationActive}
								onPublish={editor.publish}
								publication={publication}
								publishing={editor.publishing}
								websitesUrl={controller.phase === "ready" ? websitesUrl : undefined}
							/>
						</>
					}
					center={headerCenter}
					leading={
						<div className='flex items-center gap-2'>
							<WebsitePageSelect
								disabled={initialGenerationActive || agentLocked || canvasEditor.pending !== null}
								locale={canvasEditor.locale}
								onPageChange={(nextPageId) => {
									if (editor.overlay === "media") {
										editor.closeDraft();
									}

									navigate({ pageId: nextPageId });
								}}
								pageId={pageId}
								snapshot={snapshot}
							/>
							<EditorLanguageSelect
								allowAddLanguage={editor.mode === "edit" && !templatePreviewActive}
								defaultLocale={snapshot.document.defaultLocale}
								disabled={
									initialGenerationActive ||
									agentLocked ||
									canvasEditor.pending !== null ||
									(draftOverlayActive && !templatePreviewActive) ||
									catalogTarget !== null
								}
								locale={canvasEditor.locale}
								locales={templatePreviewActive ? websiteGenerationLocales : snapshot.document.locales}
								onLocaleChange={(locale) => canvasEditor.setState({ locale })}
							/>
						</div>
					}
				/>
				<WebsiteGenerationPreview
					additionActive={controller.additionActive}
					additionFailed={controller.additionFailed}
					additionRecoverable={controller.additionRecoverable}
					additionTarget={controller.additionTarget}
					blocked={controller.blocked}
					editor={canvasEditor}
					insetBottom={isMobile && openMobile}
					insetEnd={sidebarState === "collapsed"}
					layoutGenerationActive={controller.layoutGenerationActive}
					layoutGenerationFailed={controller.layoutGenerationFailed}
					layoutGenerationRecoverable={controller.layoutGenerationRecoverable}
					locale={editor.locale}
					mode={editor.mode}
					onOpenAgent={openAgent}
					onOpenSectionCatalog={openSectionCatalog}
					onRetry={retryGeneration}
					phase={controller.phase}
					snapshot={snapshot}
					viewport={editor.viewport}
				/>
			</div>
			{(role === "owner" || role === "admin") && (
				<WebsiteEditorAgentSidebar
					agentFocusRequest={agentFocusRequest}
					editor={sidebarEditor}
					locale={editor.locale}
					onAddSection={controller.addSection}
					onChangeTemplate={controller.changeTemplate}
					onGenerateLayout={controller.generateLayout}
					onLockChange={onAgentLockChange}
					sectionId={agentSectionId}
					snapshot={snapshot}
					websiteId={websiteId}
				/>
			)}
		</>
	);
};

const WebsiteEditor = ({
	controller,
	snapshot,
	websitesUrl,
}: {
	controller: ReturnType<typeof useWebsiteGenerationController>;
	snapshot: NonNullable<ReturnType<typeof useWebsiteGenerationController>["snapshot"]>;
	websitesUrl?: string;
}) => {
	const locale = useLocale();
	const sidebarProps = useEditorSidebar("/dashboard/website");
	const [agentLocked, setAgentLocked] = useState(false);

	const editor = useWebsiteEditor({
		agentLocked,
		defaultLocale: snapshot.document.defaultLocale,
		website: controller.website,
	});

	const websiteId = controller.websiteId;

	const publicUrl = useWebsitePublicUrl({
		fallback: getWebsiteUrl({ publicUrl: websitesUrl, websiteId: websiteId ?? undefined }),
		websiteId: websiteId ?? undefined,
	});

	const publication = controller.website
		? {
				...controller.website.publication,
				hasUnpublishedChanges: controller.website.publication.hasUnpublishedChanges || editor.pending !== null,
			}
		: undefined;

	const retryGeneration = async () => {
		if (controller.brief) {
			await controller.generate(controller.brief);
		}
	};

	if (!websiteId) {
		return <WebsiteLoadingState />;
	}

	return (
		<SidebarProvider
			className='min-h-0 overflow-hidden'
			surface='canvas'
			{...sidebarProps}
			defaultOpen={false}
			dir={getDirection(locale)}
			keyboardShortcut={false}
			purpose='details'
			style={websiteEditorSidebarStyle}
		>
			<WebsiteEditorShell
				agentLocked={agentLocked}
				controller={controller}
				editor={editor}
				onAgentLockChange={setAgentLocked}
				publication={publication}
				retryGeneration={retryGeneration}
				snapshot={snapshot}
				websiteId={websiteId}
				websitesUrl={publicUrl}
			/>
		</SidebarProvider>
	);
};

export const WebsitePage = ({ websitesUrl }: { websitesUrl?: string }) => {
	const { can } = useOrganizationPermissions();
	const tPermissions = useTranslations("permissions");
	const t = useTranslations("common");
	const tWebsite = useTranslations("website");
	const controller = useWebsiteGenerationController();
	const generationActive = controller.phase === "starting" || controller.phase === "streaming";

	if (controller.isLoading) {
		return (
			<>
				<WebsiteHeader />
				<WebsiteLoadingState />
			</>
		);
	}

	if (controller.loadFailed) {
		return (
			<>
				<WebsiteHeader />
				<div className='flex min-h-0 flex-1 items-center justify-center p-6' role='alert'>
					<div className='max-w-sm text-center'>
						<p className='text-sm text-muted-foreground'>{t("messages.somethingWentWrong")}</p>
						<Button className='mt-3' onClick={() => controller.retryLoad()} size='sm' variant='outline'>
							{t("retry")}
						</Button>
					</div>
				</div>
			</>
		);
	}

	if (!controller.snapshot) {
		if (generationActive) {
			return (
				<>
					<WebsiteInitialGenerationHeader />
					<WebsiteLoadingState />
				</>
			);
		}

		return (
			<>
				<WebsiteHeader />
				<div className='min-h-0 flex-1 overflow-y-auto' data-testid='website-editor-content'>
					{controller.phase === "failed" && (
						<WebsiteGenerationFailure
							blocked={controller.blocked}
							onReconnect={controller.reconnect}
							recoverable={controller.recoverable}
						/>
					)}
					{can("workspace.write") ? (
						<div className='mx-auto flex max-w-md flex-col items-start gap-4 p-6 sm:py-12'>
							<h1 className='text-2xl font-medium tracking-tight'>{tWebsite("intro.title")}</h1>
							<p className='text-sm leading-6 text-muted-foreground'>{tWebsite("intro.description")}</p>
							{controller.brief && !controller.blocked && (
								<Button onClick={() => controller.brief && controller.generate(controller.brief)}>
									{t("retry")}
								</Button>
							)}
							<Button
								nativeButton={false}
								render={<Link aria-label={tWebsite("setup")} href='/onboarding' />}
								variant={controller.brief ? "outline" : "default"}
							>
								{tWebsite("setup")}
							</Button>
						</div>
					) : (
						<p className='p-6 text-sm text-muted-foreground'>{tPermissions("readOnly")}</p>
					)}
				</div>
			</>
		);
	}

	return (
		<WebsiteEditor
			controller={controller}
			key={controller.websiteId}
			snapshot={controller.snapshot}
			websitesUrl={websitesUrl}
		/>
	);
};
