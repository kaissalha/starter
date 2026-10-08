"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { ArrowDown02Icon, ArrowUp02Icon, Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { EditorCustomizeButton } from "@/app/[locale]/dashboard/components/editor/editor-customize-button";
import { EditorDraftRecovery } from "@/app/[locale]/dashboard/components/editor/editor-draft-recovery";
import { EditorHistory } from "@/app/[locale]/dashboard/components/editor/editor-history";
import { EditorLanguageSelect } from "@/app/[locale]/dashboard/components/editor/editor-language-select";
import { EditorModeSwitch } from "@/app/[locale]/dashboard/components/editor/editor-mode-switch";
import { EditorPublishPopover } from "@/app/[locale]/dashboard/components/editor/editor-publish-popover";
import { EditorViewportToggle } from "@/app/[locale]/dashboard/components/editor/editor-viewport-toggle";
import { useEditorSidebar } from "@/app/[locale]/dashboard/components/editor/use-editor-sidebar";
import { WebsiteSettingsModal } from "@/app/[locale]/dashboard/components/editor/website-settings-modal";
import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient } from "@/lib/api-client";
import { getWebsiteUrl } from "@/utils/get-website-url";
import {
	LinkPageRenderer,
	linkPageLimits,
	type LinkPageInsertionTarget,
	type LinkPageState,
	type LinkPageTextElementProps,
	type LinkPageTextTarget,
} from "@starter/infinite-links";
import { Button } from "@starter/ui/components/button";
import { ScrollArea } from "@starter/ui/components/scroll-area";
import { type CSSPropertiesWithVariables, SidebarProvider, useSidebar } from "@starter/ui/components/sidebar";
import { cn } from "@starter/ui/lib/utils";
import { getDirection } from "@starter/utils";

import { LinksEditorSidebar } from "./links-editor";
import { findLinksSelectionContent, followLinksSelection, revealLinksSelection } from "./links-selection";
import { useLinksPageController } from "./use-links-page-controller";

const linksViewports = ["mobile", "desktop"] as const;

type LinksViewport = (typeof linksViewports)[number];

const linksEditorSidebarStyle = {
	"--sidebar-width-details": "28rem",
} satisfies CSSPropertiesWithVariables;

const useRevealDesignTarget = ({
	active,
	controller,
	frameRef,
}: {
	active: boolean;
	controller: ReturnType<typeof useLinksPageController>;
	frameRef: RefObject<HTMLDivElement | null>;
}) => {
	const { blocks, headerBlockIds } = controller.document;
	const header = new Set(headerBlockIds);
	const designing = controller.view.kind === "design" && controller.view.section === "buttons";
	const blockId = designing ? blocks.find((block) => !header.has(block.id))?.id : undefined;

	useEffect(() => {
		if (!active || !blockId) {
			return;
		}

		const frame = requestAnimationFrame(() => revealLinksSelection({ blockId, frame: frameRef.current }));

		return () => cancelAnimationFrame(frame);
	}, [active, blockId, frameRef]);
};

const LinksHeader = ({
	actions,
	center,
	leading,
}: {
	actions?: ReactNode;
	center?: ReactNode;
	leading?: ReactNode;
}) => (
	<Header
		actions={actions}
		center={center}
		centerClassName='hidden md:flex'
		className='gap-x-1.5 px-2 py-1.5 sm:px-3 sm:py-2 md:px-3'
		item={{ labelTx: "links" }}
		leading={leading ?? null}
	/>
);

const LinksModeSwitch = ({ controller }: { controller: ReturnType<typeof useLinksPageController> }) => {
	const t = useTranslations("links.modes");

	return (
		<EditorModeSwitch
			aria-label={t("preview")}
			checked={controller.mode === "preview"}
			disabled={!controller.can("workspace.write") || controller.view.kind === "agent"}
			onCheckedChange={(checked) => controller.setMode(checked ? "preview" : "edit")}
		/>
	);
};

export const LinksPageLoading = () => {
	const t = useTranslations("links");

	return (
		<>
			<LinksHeader />
			<div aria-label={t("loading")} className='flex min-h-0 flex-1 overflow-hidden bg-background' role='status'>
				<div className='shimmer-container flex min-h-0 flex-1'>
					<div className='min-h-0 flex-1 md:px-2 md:pb-2'>
						<div className='flex h-full w-full flex-col items-center rounded-none bg-background pt-16 md:rounded-2xl md:smooth-shadow-ring-md'>
							<div className='shimmer shimmer-bg size-24 rounded-full bg-muted/72' />
							<div className='shimmer shimmer-bg mt-5 h-7 w-44 bg-muted/72' />
							<div className='shimmer shimmer-bg mt-3 h-4 w-64 bg-muted/52' />
							<div className='mt-9 w-full max-w-xl space-y-3 px-6'>
								<div className='shimmer shimmer-bg h-14 rounded-xl bg-muted/52' />
								<div className='shimmer shimmer-bg h-14 rounded-xl bg-muted/52' />
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

const LinksPageFailure = ({ onRetry }: { onRetry: () => void }) => {
	const t = useTranslations("links");

	return (
		<>
			<LinksHeader />
			<div className='flex min-h-0 flex-1 items-center justify-center p-6' role='alert'>
				<div className='max-w-sm text-center'>
					<p className='text-sm text-muted-foreground'>{t("loadFailed")}</p>
					<Button className='mt-3' onClick={onRetry} size='sm' variant='outline'>
						{t("retry")}
					</Button>
				</div>
			</div>
		</>
	);
};

const LinksBlockControls = ({
	controller,
	onOpenDetails,
	target,
}: {
	controller: ReturnType<typeof useLinksPageController>;
	onOpenDetails: () => void;
	target: { id: string };
}) => {
	const t = useTranslations("links.editor.blockActions");
	const headerBlockIds = new Set(controller.document.headerBlockIds);
	const inHeader = headerBlockIds.has(target.id);
	const sectionBlocks = controller.document.blocks.filter((block) => headerBlockIds.has(block.id) === inHeader);
	const sectionIndex = sectionBlocks.findIndex((block) => block.id === target.id);
	const canMoveUp = sectionIndex > 0;
	const canMoveDown = sectionIndex >= 0 && sectionIndex < sectionBlocks.length - 1;

	return (
		<div aria-label={t("toolbar")} role='toolbar'>
			<div className='flex overflow-hidden rounded-2xl bg-popover p-1 smooth-shadow-ring-md'>
				<Button
					onClick={() => {
						controller.openBlock(target.id);
						onOpenDetails();
					}}
					size='default'
					type='button'
					variant='ghost'
				>
					{t("design")}
				</Button>
				<Button
					aria-label={t("moveUp")}

					disabled={!canMoveUp}
					onClick={() => controller.moveBlock({ id: target.id, offset: -1 })}
					size='icon'
					title={t("moveUp")}
					type='button'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={ArrowUp02Icon} strokeWidth={1.75} />
				</Button>
				<Button
					aria-label={t("moveDown")}

					disabled={!canMoveDown}
					onClick={() => controller.moveBlock({ id: target.id, offset: 1 })}
					size='icon'
					title={t("moveDown")}
					type='button'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={ArrowDown02Icon} strokeWidth={1.75} />
				</Button>
				<Button
					aria-label={t("delete")}

					disabled={!controller.can("workspace.delete")}
					onClick={() => controller.removeBlock({ id: target.id })}
					size='icon'
					title={t("delete")}
					type='button'
					variant='destructive-ghost'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Delete02Icon} strokeWidth={1.75} />
				</Button>
			</div>
		</div>
	);
};

const LinksInsertionControl = ({
	activeBlockId,
	controller,
	onOpenDetails,
	target,
}: {
	activeBlockId: string | null | undefined;
	controller: ReturnType<typeof useLinksPageController>;
	onOpenDetails: () => void;
	target: LinkPageInsertionTarget;
}) => {
	const t = useTranslations("links.editor");

	const sectionBlocks = controller.document.blocks.filter(
		(block) => controller.document.headerBlockIds.includes(block.id) === (target.placement === "header")
	);

	const empty = sectionBlocks.length === 0;
	const selectedIndex = sectionBlocks.findIndex((block) => block.id === activeBlockId);

	const active =
		activeBlockId === null
			? target.index === 0
			: selectedIndex >= 0 && (target.index === selectedIndex || target.index === selectedIndex + 1);

	const hasSocials = controller.document.blocks.some((block) => block.kind === "socials");
	const contentBlockCount = controller.document.blocks.filter((block) => block.kind !== "socials").length;
	const atLimit = hasSocials && contentBlockCount >= linkPageLimits.blocks;
	const trailing = target.placement === "page" && target.index === sectionBlocks.length;

	return (
		<div
			className={cn(
				"pointer-events-auto absolute inset-0 z-40 flex items-center justify-center",
				!active && !empty && !trailing && "invisible md:[@media(pointer:fine)]:visible"
			)}
		>
			<div className='absolute inset-x-0 flex items-center justify-center'>
				<div
					aria-hidden='true'
					className={cn(
						"absolute inset-x-0 h-0.5 bg-[var(--color-selection)] opacity-0 transition-opacity duration-150 ease-out group-focus-within/links-insertion:opacity-100 group-hover/links-insertion:opacity-100 motion-reduce:transition-none",
						(active || empty) && "[@media(pointer:coarse)]:opacity-100"
					)}
				/>
				<Button
					aria-label={t("addBlock")}
					disabled={atLimit}
					onClick={() => {
						controller.setView({ index: target.index, kind: "add-block", placement: target.placement });
						onOpenDetails();
					}}
					revealOnHover={!empty}
					size='xs'
					type='button'
					variant='insertion'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
					{t("addBlock")}
				</Button>
			</div>
		</div>
	);
};

const LinksProfileControls = ({
	controller,
	onOpenDetails,
}: {
	controller: ReturnType<typeof useLinksPageController>;
	onOpenDetails: () => void;
}) => {
	const t = useTranslations("links.editor.blockActions");

	return (
		<div aria-label={t("toolbar")} role='toolbar'>
			<div className='flex overflow-hidden rounded-2xl bg-popover p-1 smooth-shadow-ring-md'>
				<Button
					onClick={() => {
						controller.setView({ kind: "design", section: "header" });
						onOpenDetails();
					}}
					size='default'
					type='button'
					variant='ghost'
				>
					{t("design")}
				</Button>
			</div>
		</div>
	);
};

const createLinksTextElementProps =
	({
		controller,
		label,
		placeholder,
	}: {
		controller: ReturnType<typeof useLinksPageController>;
		label: string;
		placeholder: string;
	}) =>
	(target: LinkPageTextTarget): LinkPageTextElementProps => ({
		"aria-label": label,
		"aria-multiline": target.multiline,
		"aria-placeholder": placeholder,
		contentEditable: "plaintext-only",
		"data-links-inline-text": "",
		"data-placeholder": placeholder,
		onBlur: (event) => {
			const value = (event.currentTarget.textContent ?? "").slice(0, target.maxLength);

			if (value !== target.content) {
				controller.updateInlineText({ target, value });
			}
		},
		onClick: (event) => {
			event.preventDefault();
			event.stopPropagation();
		},
		onKeyDown: (event) => {
			event.stopPropagation();

			if (event.key === "Escape") {
				event.preventDefault();
				event.currentTarget.textContent = target.content;
				event.currentTarget.blur();
			} else if (event.key === "Enter" && !target.multiline) {
				event.preventDefault();
				event.currentTarget.blur();
			}
		},
		role: "textbox",
		spellCheck: true,
		suppressContentEditableWarning: true,
		tabIndex: 0,
	});

const LinksSelectionControls = ({
	activeBlock,
	controller,
	onOpenDetails,
}: {
	activeBlock?: { id: string };
	controller: ReturnType<typeof useLinksPageController>;
	onOpenDetails: () => void;
}) =>
	activeBlock ? (
		<LinksBlockControls controller={controller} onOpenDetails={onOpenDetails} target={activeBlock} />
	) : (
		<LinksProfileControls controller={controller} onOpenDetails={onOpenDetails} />
	);

const LinksSideToolbar = ({
	activeBlock,
	controller,
	onOpenDetails,
	toolbarRef,
	visible,
}: {
	activeBlock?: { id: string };
	controller: ReturnType<typeof useLinksPageController>;
	onOpenDetails: () => void;
	toolbarRef: RefObject<HTMLDivElement | null>;
	visible: boolean;
}) => (
	<div className='absolute inset-y-0 start-full hidden w-64 md:[@media(pointer:fine)]:block'>
		<div className='absolute -start-4 end-0' data-links-toolbar-corridor='' ref={toolbarRef}>
			{visible && (
				<div className='absolute start-4 top-1/2 -translate-y-1/2'>
					<LinksSelectionControls
						activeBlock={activeBlock}
						controller={controller}
						onOpenDetails={onOpenDetails}
					/>
				</div>
			)}
		</div>
	</div>
);

const LinksPreview = ({
	controller,
	onOpenDetails,
	viewport,
}: {
	controller: ReturnType<typeof useLinksPageController>;
	onOpenDetails: () => void;
	viewport: LinksViewport;
}) => {
	const t = useTranslations("links");
	const { isMobile, openMobile } = useSidebar("details");
	const frameRef = useRef<HTMLDivElement>(null);
	const toolbarRef = useRef<HTMLDivElement>(null);
	const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
	useRevealDesignTarget({ active: isMobile && openMobile, controller, frameRef });
	const [toolbarVisible, setToolbarVisible] = useState(false);

	const activeBlock = activeBlockId
		? controller.document.blocks.find((block) => block.id === activeBlockId)
		: undefined;

	const selectedBlockId = activeBlock?.id ?? null;
	const editing = controller.mode === "edit";
	const desktop = viewport === "desktop";

	const synchronizeToolbar = useCallback(() => {
		const frame = frameRef.current;
		const toolbar = toolbarRef.current;

		if (!frame || !toolbar) {
			return;
		}

		const section = findLinksSelectionContent({ blockId: selectedBlockId, frame });

		if (!section) {
			return;
		}

		const frameBounds = frame.getBoundingClientRect();
		const sectionBounds = section.getBoundingClientRect();
		const height = Math.max(sectionBounds.height, 64);
		const center = sectionBounds.top - frameBounds.top + sectionBounds.height / 2;
		const top = Math.min(Math.max(center - height / 2, 0), Math.max(frameBounds.height - height, 0));
		toolbar.style.height = `${height}px`;
		toolbar.style.top = `${top}px`;
	}, [selectedBlockId]);

	useLayoutEffect(() => {
		const frame = frameRef.current;

		if (!editing || !frame) {
			return;
		}

		const section = findLinksSelectionContent({ blockId: selectedBlockId, frame });
		const observer = globalThis.ResizeObserver ? new ResizeObserver(synchronizeToolbar) : null;
		observer?.observe(frame);

		if (section) {
			observer?.observe(section);
		}

		frame.addEventListener("scroll", synchronizeToolbar, true);
		window.addEventListener("resize", synchronizeToolbar);
		synchronizeToolbar();

		return () => {
			observer?.disconnect();
			frame.removeEventListener("scroll", synchronizeToolbar, true);
			window.removeEventListener("resize", synchronizeToolbar);
		};
	}, [editing, selectedBlockId, synchronizeToolbar]);

	const openSelectionDetails = () => {
		onOpenDetails();

		if (isMobile) {
			requestAnimationFrame(() =>
				requestAnimationFrame(() => revealLinksSelection({ blockId: selectedBlockId, frame: frameRef.current }))
			);
		}
	};

	const textElementProps = createLinksTextElementProps({
		controller,
		label: t("inlineEdit.label"),
		placeholder: t("inlineEdit.placeholder"),
	});

	const activateSection = (element: Element) => {
		const block = element.closest<HTMLElement>("[data-links-block-id]");

		if (block?.dataset.linksBlockId) {
			setActiveBlockId(block.dataset.linksBlockId);
			setToolbarVisible(true);

			return true;
		}

		if (element.closest("[data-links-profile]")) {
			setActiveBlockId(null);
			setToolbarVisible(true);

			return true;
		}

		return false;
	};

	return (
		<div
			aria-label={t("preview")}
			className='relative isolate flex min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-muted/64 md:rounded-2xl'
		>
			<div className='relative flex min-h-0 flex-1 items-center justify-center transition-[padding] duration-200 ease-linear md:p-5 lg:p-6 motion-reduce:transition-none'>
				<div
					className={cn(
						"relative flex h-full min-h-0 w-full items-stretch justify-center transition-[max-width] duration-300 ease-out md:h-[calc(100dvh-6.5rem)] motion-reduce:transition-none",
						desktop ? "max-w-full" : "max-h-[53rem] max-w-[26rem]"
					)}
					onBlurCapture={(event) => {
						if (
							!(event.relatedTarget instanceof Node) ||
							!event.currentTarget.contains(event.relatedTarget)
						) {
							setToolbarVisible(false);
						}
					}}
					onClickCapture={(event) => {
						if (editing && event.target instanceof Element && !event.target.closest("button")) {
							if (!activateSection(event.target)) {
								setToolbarVisible(false);
							} else if (isMobile && openMobile) {
								followLinksSelection({ controller, element: event.target });
							}
						}
					}}
					onFocusCapture={(event) => {
						if (event.target instanceof Element) {
							activateSection(event.target);
						}
					}}
					onPointerLeave={(event) => {
						if (
							event.pointerType === "mouse" &&
							!event.currentTarget.contains(globalThis.document.activeElement)
						) {
							setToolbarVisible(false);
						}
					}}
					onPointerMove={(event) => {
						if (
							event.pointerType !== "mouse" ||
							!window.matchMedia("(min-width: 768px) and (pointer: fine)").matches ||
							!(event.target instanceof Element)
						) {
							return;
						}

						if (!activateSection(event.target)) {
							setToolbarVisible(Boolean(event.target.closest("[data-links-toolbar-corridor]")));
						}
					}}
				>
					<div
						className={cn(
							"flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden bg-background max-md:p-0 max-md:smooth-shadow-none md:p-1.5 md:smooth-shadow-ring-lg",
							desktop ? "rounded-2xl" : "max-w-[26rem] max-md:rounded-none md:rounded-[2rem]"
						)}
						data-links-viewport={viewport}
						ref={frameRef}
					>
						<div
							className={cn(
								desktop
									? "rounded-[0.625rem]"
									: "max-md:rounded-none max-md:ring-0 md:rounded-[1.625rem]",
								editing &&
									"[&_iframe]:pointer-events-none [&_[data-links-block-content]_input]:pointer-events-none [&_[data-links-block-content]_textarea]:pointer-events-none",
								"flex min-h-0 flex-1 flex-col overflow-hidden bg-background ring-1 ring-border/64 [&_[data-links-inline-text]]:relative [&_[data-links-inline-text]]:z-20 [&_[data-links-inline-text]]:min-w-[min(8ch,100%)] [&_[data-links-inline-text]]:cursor-text [&_[data-links-inline-text]]:outline-2 [&_[data-links-inline-text]]:outline-transparent [&_[data-links-inline-text]]:outline-offset-1 [&_[data-links-inline-text]]:transition-[outline-color,background-color] [&_[data-links-inline-text]]:duration-[120ms] [&_[data-links-inline-text]]:ease-out [&_[data-links-inline-text]:empty]:before:text-current [&_[data-links-inline-text]:empty]:before:opacity-45 [&_[data-links-inline-text]:empty]:before:content-[attr(data-placeholder)] [&_[data-links-inline-text]:focus]:bg-[color-mix(in_srgb,var(--color-selection)_8%,transparent)] [&_[data-links-inline-text]:focus]:outline-[var(--color-selection)] [&_[data-links-inline-text]:hover]:outline-[color-mix(in_srgb,var(--color-selection)_72%,transparent)] [&_[data-links-inline-text]::selection]:bg-[color-mix(in_srgb,var(--color-selection)_28%,transparent)] [&_[data-links-inline-text]::selection]:text-current motion-reduce:[&_[data-links-inline-text]]:transition-none"
							)}
						>
							<ScrollArea className='flex-1' corners='sm' viewportClassName='overscroll-none'>
								<LinkPageRenderer
									brand={controller.brand}
									document={controller.document}
									locale={controller.locale}
									preview
									renderBlockControls={editing ? () => null : undefined}
									renderInsertionControl={
										editing
											? (target) => (
													<LinksInsertionControl
														activeBlockId={toolbarVisible ? activeBlockId : undefined}
														controller={controller}
														onOpenDetails={onOpenDetails}
														target={target}
													/>
												)
											: undefined
									}
									renderProfileControls={editing ? () => null : undefined}
									textElementProps={editing ? textElementProps : undefined}
								/>
								{isMobile && openMobile && <div aria-hidden='true' className='h-[56dvh]' />}
							</ScrollArea>
						</div>
					</div>
					{editing && (
						<LinksSideToolbar
							activeBlock={activeBlock}
							controller={controller}
							onOpenDetails={onOpenDetails}
							toolbarRef={toolbarRef}
							visible={toolbarVisible}
						/>
					)}
					{editing && toolbarVisible && (
						<div
							className='pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center p-3 md:[@media(pointer:fine)]:hidden'
							data-links-touch-toolbar=''
						>
							<div className='pointer-events-auto' onPointerDown={(event) => event.preventDefault()}>
								<LinksSelectionControls
									activeBlock={activeBlock}
									controller={controller}
									onOpenDetails={openSelectionDetails}
								/>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const LinksBuilderShell = ({
	controller,
	linksUrl,
}: {
	controller: ReturnType<typeof useLinksPageController>;
	linksUrl?: string;
}) => {
	const { isMobile, setOpen, setOpenMobile } = useSidebar("details");

	const openDetails = () => {
		if (isMobile) {
			setOpenMobile(true, { closeOthers: true });

			return;
		}

		setOpen(true);
	};

	const publication = {
		...controller.state.publication,
		hasUnpublishedChanges: controller.state.publication.hasUnpublishedChanges || controller.dirty,
	};

	const [selectedViewport, setViewport] = useState<LinksViewport>("mobile");
	const viewport = isMobile || controller.mode === "edit" ? "mobile" : selectedViewport;
	const customizeAction = <EditorCustomizeButton isMobile={isMobile} />;

	return (
		<>
			<div
				className='flex min-h-0 min-w-0 flex-1 flex-col'
				inert={controller.translating || controller.languages.pending}
			>
				<LinksHeader
					actions={
						<>
							{isMobile && controller.mode === "edit" && customizeAction}
							<WebsiteSettingsModal
								disabled={controller.view.kind !== "root"}
								onAddLanguage={controller.translate}
								publicUrl={linksUrl}
								showTrigger={false}
							/>
							<LinksModeSwitch controller={controller} />
							<EditorPublishPopover
								disabled={!controller.valid || controller.view.kind === "agent"}
								kind='links'
								onPublish={controller.publish}
								publication={publication}
								publicUrl={linksUrl}
								publishing={controller.publishing}
							/>
						</>
					}
					center={
						controller.mode === "preview" ? (
							<EditorViewportToggle
								onViewportChange={setViewport}
								viewport={viewport}
								viewports={linksViewports}
							/>
						) : (
							!isMobile && customizeAction
						)
					}
					leading={
						<div className='flex items-center gap-1'>
							<EditorLanguageSelect
								allowAddLanguage={controller.languages.enabled && controller.view.kind === "root"}
								defaultLocale={controller.brand.defaultLocale}
								disabled={
									controller.view.kind === "agent" ||
									controller.translating ||
									controller.languages.pending
								}
								locale={controller.locale}
								locales={controller.locales}
								onLocaleChange={controller.selectLocale}
							/>
							{controller.mode === "edit" && (
								<EditorHistory
									canRedo={controller.canRedo}
									canUndo={controller.canUndo}
									onRedo={controller.redo}
									onUndo={controller.undo}
								/>
							)}
						</div>
					}
				/>
				<EditorDraftRecovery
					error={controller.error}
					hasRecovery={controller.hasRecovery}
					onDismiss={controller.dismissRecovery}
					onDownload={controller.downloadDraft}
					onReload={() => controller.refresh()}
					onRetry={() => controller.retrySave()}
					pending={controller.saving || controller.publishing}
				/>
				<div
					className='flex min-h-0 flex-1 transition-[padding] duration-200 ease-linear md:ps-2 md:pb-2 motion-reduce:transition-none'
					inert={controller.view.kind === "agent" || controller.translating}
				>
					<LinksPreview controller={controller} onOpenDetails={openDetails} viewport={viewport} />
				</div>
			</div>
			{controller.mode === "edit" && <LinksEditorSidebar controller={controller} />}
		</>
	);
};

const LinksPageContent = ({ initialState, linksUrl }: { initialState: LinkPageState; linksUrl?: string }) => {
	const appLocale = useLocale();
	const sidebarProps = useEditorSidebar("/dashboard/links");
	const controller = useLinksPageController({ initialState });

	return (
		<SidebarProvider
			className='min-h-0 overflow-hidden'
			surface='canvas'
			{...sidebarProps}
			dir={getDirection(appLocale)}
			keyboardShortcut={false}
			purpose='details'
			style={linksEditorSidebarStyle}
		>
			<LinksBuilderShell controller={controller} linksUrl={linksUrl} />
		</SidebarProvider>
	);
};

export const LinksPage = ({ linksUrl }: { linksUrl?: string }) => {
	const { organizationId, userId } = useOrganizationPermissions();
	const query = useQuery(apiClient.linkPages.get.queryOptions());
	const website = useQuery(apiClient.websites.get.queryOptions());
	const publicUrl = getWebsiteUrl({ pathname: "/links", publicUrl: linksUrl, websiteId: website.data?.id });

	if (query.isPending) {
		return <LinksPageLoading />;
	}

	if (query.isError) {
		return <LinksPageFailure onRetry={() => query.refetch()} />;
	}

	return <LinksPageContent initialState={query.data} key={`${userId}:${organizationId}`} linksUrl={publicUrl} />;
};
