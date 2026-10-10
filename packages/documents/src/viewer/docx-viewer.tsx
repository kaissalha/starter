"use client";

import * as React from "react";

import {
	DocxEditorViewer,
	useDocxComments,
	useDocxEditor,
	useDocxPageLayout,
	useDocxTrackChanges,
	useDocxViewerThumbnails,
	type DocxCommentCardRenderProps,
	type DocxDocumentTheme,
	type DocxEditorController,
	type DocxPageThumbnailItem,
	type DocxTrackedChangeCardRenderProps,
	type ViewerZoomLevel,
	type ViewerZoomState,
} from "@extend-ai/react-docx";
import {
	Comment01Icon,
	Download01Icon,
	FileDiffIcon,
	MinusSignCircleIcon,
	MoreHorizontalIcon,
	PlusSignCircleIcon,
	SidebarLeftIcon,
	Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { Card } from "@starter/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";
import { Input } from "@starter/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Separator } from "@starter/ui/components/separator";
import { TooltipProvider } from "@starter/ui/components/tooltip";
import { cn } from "@starter/ui/lib/utils";

import { DOCX_MIME_TYPE } from "../file";
import { useDocumentViewerLabels, useDocumentViewerToolbarLeading } from "./context";
import {
	DocumentViewerThumbnailSidebar,
	ToolbarTooltip,
	ViewerLoadingSurface,
	ViewerScrollArea,
	ViewerSpinner,
	useDelayedLoadingIndicator,
	useElementWidth,
} from "./viewer-shared";
import { ZOOM_MODE_LABELS, downloadBlob, ensureExtension, formatFileName, isZoomMode } from "./viewer-utils";

const DOCX_THUMBNAIL_WIDTH = 92;
const DOCX_THUMBNAIL_LIST_PADDING = 16;
const DOCX_THUMBNAIL_ROW_ESTIMATE = 172;
const DEFAULT_ZOOM = 50;
const ZOOM_OPTIONS = [50, 75, 100, 125, 150, 175, 200] as const;
const DOCX_PADDING_WARNING_TEXT = "a style property during rerender";
const DOCX_THUMBNAIL_FOCUS_RING_CLASS =
	"group-focus-visible/docx-thumbnail-sidebar:ring-2 group-focus-visible/docx-thumbnail-sidebar:ring-ring group-focus-visible/docx-thumbnail-sidebar:ring-offset-1 group-focus-visible/docx-thumbnail-sidebar:ring-offset-background";
const DOCX_THUMBNAIL_PREFETCH_ROWS = 4;
type UploadedDocxFile = {
	file: File;
	identity: string;
	sourceUrl: string | undefined;
};
type DocxActivePageStore = {
	getSnapshot: () => number;
	setActivePage: React.Dispatch<React.SetStateAction<number>>;
	subscribe: (listener: () => void) => () => void;
};
type DocxThumbnailRenderWindowState = {
	visiblePageIndexes: number[];
	prefetchPageIndexes: number[];
};
function createDocxActivePageStore(): DocxActivePageStore {
	let activePage = 1;
	const listeners = new Set<() => void>();
	return {
		getSnapshot: () => activePage,
		setActivePage: (nextPage) => {
			const value = typeof nextPage === "function" ? nextPage(activePage) : nextPage;
			const normalizedValue = Math.max(1, Math.round(value || 1));
			if (normalizedValue === activePage) return;
			activePage = normalizedValue;
			listeners.forEach((listener) => listener());
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
function useDocxActivePage(activePageStore: DocxActivePageStore) {
	return React.useSyncExternalStore(
		activePageStore.subscribe,
		activePageStore.getSnapshot,
		activePageStore.getSnapshot
	);
}
function areNumberArraysEqual(left: number[], right: number[]) {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}
async function loadDocxFile(url: string, displayFileName: string): Promise<File> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch DOCX (${response.status})`);
	}
	const blob = await response.blob();
	return new File([blob], displayFileName, {
		type: blob.type || DOCX_MIME_TYPE,
	});
}
async function downloadDocxFile({ file, fileName, url }: { file?: File; fileName: string; url?: string }) {
	if (file) {
		downloadBlob(file, ensureExtension(fileName, ["docx"]));
		return;
	}
	if (!url) return;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download DOCX (${response.status})`);
	}
	downloadBlob(await response.blob(), ensureExtension(fileName, ["docx"]));
}
function getNextZoomScale(currentZoomScale: number, direction: 1 | -1) {
	if (direction > 0) {
		return ZOOM_OPTIONS.find((value) => value > currentZoomScale) ?? currentZoomScale;
	}
	for (let index = ZOOM_OPTIONS.length - 1; index >= 0; index -= 1) {
		const value = ZOOM_OPTIONS[index];
		if (value < currentZoomScale) return value;
	}
	return currentZoomScale;
}
function isDocxPaddingWarning(args: unknown[]) {
	return (
		typeof args[0] === "string" &&
		args[0].includes(DOCX_PADDING_WARNING_TEXT) &&
		args.some((arg) => String(arg).includes("padding"))
	);
}
function useSuppressDocxPaddingWarning(enabled: boolean) {
	React.useEffect(() => {
		if (!enabled) return;
		const originalConsoleError = console.error;
		console.error = (...args: unknown[]) => {
			if (isDocxPaddingWarning(args)) return;
			originalConsoleError(...args);
		};
		return () => {
			console.error = originalConsoleError;
		};
	}, [enabled]);
}
function isInteractiveViewerTarget(target: EventTarget | null) {
	return (
		target instanceof Element &&
		Boolean(
			target.closest(
				'a[href], button, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"]'
			)
		)
	);
}
type AnnotationBadgeVariant = "outline" | "secondary" | "success" | "error" | "warning" | "info";
function trackedChangeBadgeVariant(kind: DocxTrackedChangeCardRenderProps["change"]["kind"]): AnnotationBadgeVariant {
	switch (kind) {
		case "insertion":
		case "move-to":
			return "success";
		case "deletion":
		case "move-from":
			return "error";
		default:
			return "warning";
	}
}
function trackedChangeBadgeLabel({
	change,
	kindLabel,
}: Pick<DocxTrackedChangeCardRenderProps, "change" | "kindLabel">) {
	switch (change.kind) {
		case "insertion":
			return "Inserted";
		case "deletion":
			return "Removed";
		case "move-from":
			return "Moved from";
		case "move-to":
			return "Moved to";
		default:
			return kindLabel;
	}
}
function DocxAnnotationCard({
	anchorText,
	badge,
	badgeVariant = "outline",
	date,
	meta,
	documentTheme,
	snippet,
	style,
}: {
	anchorText?: string;
	badge: string;
	badgeVariant?: AnnotationBadgeVariant;
	date?: string;
	documentTheme: DocxDocumentTheme;
	meta: string;
	snippet: string;
	style: React.CSSProperties;
}) {
	const isDarkDocument = documentTheme === "dark";
	const cardStyle: React.CSSProperties = {
		...style,
		backgroundColor: isDarkDocument ? "rgb(24 24 27 / 0.95)" : "rgb(255 255 255 / 0.95)",
		color: isDarkDocument ? "#f4f4f5" : "#18181b",
	};
	const mutedTextColor = isDarkDocument ? "#a1a1aa" : "#71717a";
	const anchorStyle: React.CSSProperties = {
		backgroundColor: isDarkDocument ? "rgb(63 63 70 / 0.55)" : "rgb(244 244 245 / 0.75)",
		color: mutedTextColor,
	};
	return (
		<Card
			style={cardStyle}
			className='pointer-events-auto box-border gap-2 rounded-lg p-2 shadow-sm before:rounded-[7px]'
		>
			<div className='flex min-w-0 items-start justify-between gap-2'>
				<div className='min-w-0 text-[11px] leading-tight font-medium' style={{ color: mutedTextColor }}>
					<div className='truncate'>{meta}</div>
					{date ? <div className='mt-0.5 truncate'>{date}</div> : null}
				</div>
				<Badge
					variant={badgeVariant === "outline" ? "outline" : "secondary"}
					className={cn(
						"h-4 px-1 text-[10px]",
						cn(
							"max-w-[92px] truncate",
							badgeVariant === "success" && "bg-green-500/10 text-green-700 dark:text-green-300",
							badgeVariant === "error" && "bg-destructive/10 text-destructive",
							badgeVariant === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
							badgeVariant === "info" && "bg-blue-500/10 text-blue-700 dark:text-blue-300"
						)
					)}
				>
					{badge}
				</Badge>
			</div>
			{anchorText ? (
				<div className='rounded-md px-2 py-1 text-[11px] leading-snug italic' style={anchorStyle}>
					{anchorText}
				</div>
			) : null}
			<div className='text-xs leading-snug break-words'>{snippet}</div>
		</Card>
	);
}
function createDocxTrackedChangeCardRenderer(documentTheme: DocxDocumentTheme) {
	return function renderDocxTrackedChangeCard({
		change,
		formattedDate,
		kindLabel,
		snippet,
		style,
	}: DocxTrackedChangeCardRenderProps) {
		return (
			<DocxAnnotationCard
				badge={trackedChangeBadgeLabel({ change, kindLabel })}
				badgeVariant={trackedChangeBadgeVariant(change.kind)}
				date={formattedDate}
				documentTheme={documentTheme}
				meta={change.author?.trim() || "Unknown author"}
				snippet={snippet}
				style={style}
			/>
		);
	};
}
function createDocxCommentCardRenderer(documentTheme: DocxDocumentTheme) {
	return function renderDocxCommentCard({ comment, formattedDate, snippet, style }: DocxCommentCardRenderProps) {
		const badge = comment.resolved ? "Resolved" : comment.parentId !== undefined ? "Reply" : "Comment";
		return (
			<DocxAnnotationCard
				anchorText={comment.anchorText}
				badge={badge}
				badgeVariant={comment.resolved ? "secondary" : "info"}
				date={formattedDate}
				documentTheme={documentTheme}
				meta={comment.author?.trim() || "Unknown author"}
				snippet={snippet}
				style={style}
			/>
		);
	};
}
function DocxFileActionsMenu({
	controlsDisabled,
	downloadDisabled,
	isPreparingDownload,
	onDownload,
	onShowCommentsChange,
	onShowTrackedChangesChange,
	onUploadClick,
	showComments,
	showDownloadButton,
	showTrackedChanges,
	showUploadButton,
}: {
	controlsDisabled: boolean;
	downloadDisabled: boolean;
	isPreparingDownload: boolean;
	onDownload: () => void;
	onShowCommentsChange: (checked: boolean) => void;
	onShowTrackedChangesChange: (checked: boolean) => void;
	onUploadClick: () => void;
	showComments: boolean;
	showDownloadButton: boolean;
	showTrackedChanges: boolean;
	showUploadButton: boolean;
}) {
	const labels = useDocumentViewerLabels();
	const showFileActions = showDownloadButton || showUploadButton;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button type='button' variant='ghost' size='icon-sm' aria-label={labels.moreActions}>
						<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.75} className='size-4' />
					</Button>
				}
			></DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-52'>
				<DropdownMenuCheckboxItem
					checked={showComments}
					disabled={controlsDisabled}
					onCheckedChange={(checked) => onShowCommentsChange(checked === true)}
					className={cn("justify-between")}
				>
					<span className='flex min-w-0 items-center gap-2'>
						<HugeiconsIcon icon={Comment01Icon} strokeWidth={1.75} className='size-4' />
						{labels.comments}
					</span>
				</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem
					checked={showTrackedChanges}
					disabled={controlsDisabled}
					onCheckedChange={(checked) => onShowTrackedChangesChange(checked === true)}
					className={cn("justify-between")}
				>
					<span className='flex min-w-0 items-center gap-2'>
						<HugeiconsIcon icon={FileDiffIcon} strokeWidth={1.75} className='size-4' />
						{labels.edits}
					</span>
				</DropdownMenuCheckboxItem>
				{showFileActions ? <DropdownMenuSeparator /> : null}
				{showDownloadButton ? (
					<DropdownMenuItem disabled={downloadDisabled} onClick={onDownload}>
						{isPreparingDownload ? (
							<ViewerSpinner />
						) : (
							<HugeiconsIcon icon={Download01Icon} strokeWidth={1.75} className='size-4' />
						)}
						Download
					</DropdownMenuItem>
				) : null}
				{showUploadButton ? (
					<DropdownMenuItem onClick={onUploadClick}>
						<HugeiconsIcon icon={Upload01Icon} strokeWidth={1.75} className='size-4' />
						Upload
					</DropdownMenuItem>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
function DocxPageNumberControl({
	activePageStore,
	controlsDisabled,
	onPageChange,
	pageCount,
}: {
	activePageStore: DocxActivePageStore;
	controlsDisabled: boolean;
	onPageChange: (pageNumber: number) => void;
	pageCount: number;
}) {
	const labels = useDocumentViewerLabels();
	const activePage = useDocxActivePage(activePageStore);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const displayPage = pageCount ? activePage : 1;
	const [isEditing, setIsEditing] = React.useState(false);
	const [draftPage, setDraftPage] = React.useState(() => String(displayPage));
	React.useEffect(() => {
		if (!isEditing) return;
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [isEditing]);
	const applyPageDraft = React.useCallback(
		(value: string) => {
			const trimmedValue = value.trim();
			if (!trimmedValue) return;
			const parsedPage = Number(trimmedValue);
			if (!Number.isInteger(parsedPage)) return;
			onPageChange(Math.min(Math.max(parsedPage, 1), Math.max(pageCount, 1)));
		},
		[onPageChange, pageCount]
	);
	return (
		<div className='flex shrink-0 items-center text-sm whitespace-nowrap text-primary'>
			<span>{labels.page}</span>
			{isEditing ? (
				<Input
					ref={inputRef}
					aria-label={labels.pageNumber}
					inputMode='numeric'
					pattern='[0-9]*'
					value={draftPage}
					onBlur={() => setIsEditing(false)}
					onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
						const nextValue = event.target.value;
						setDraftPage(nextValue);
						applyPageDraft(nextValue);
					}}
					onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
						if (event.key === "Enter" || event.key === "Escape") {
							event.currentTarget.blur();
						}
					}}
					className={cn("h-8 px-2.5", "mx-1 w-14 min-w-14 rounded-md [&_[data-slot=input]]:text-center")}
				/>
			) : (
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className='font-normal'
					aria-label={`Current page ${displayPage}. Edit page number`}
					disabled={controlsDisabled || !pageCount}
					onClick={() => {
						setDraftPage(String(displayPage));
						setIsEditing(true);
					}}
				>
					{displayPage}
				</Button>
			)}
			<span>
				{labels.of} {pageCount || "-"}
			</span>
		</div>
	);
}
function DocxToolbar({
	activePageStore,
	controlsDisabled,
	isPreparingDownload,
	onDownload,
	onPageChange,
	onShowCommentsChange,
	onShowTrackedChangesChange,
	onToggleSidebar,
	onUploadClick,
	onZoomChange,
	pageCount,
	resolvedZoom,
	showComments,
	showDownloadButton = true,
	showTrackedChanges,
	showUploadButton = true,
	toolbarActions,
	zoomLevel,
}: {
	activePageStore: DocxActivePageStore;
	controlsDisabled: boolean;
	isPreparingDownload: boolean;
	onDownload: () => void;
	onPageChange: (pageNumber: number) => void;
	onShowCommentsChange: (checked: boolean) => void;
	onShowTrackedChangesChange: (checked: boolean) => void;
	onToggleSidebar: () => void;
	onUploadClick: () => void;
	onZoomChange: (zoomLevel: ViewerZoomLevel) => void;
	pageCount: number;
	resolvedZoom: number;
	showComments: boolean;
	showDownloadButton?: boolean;
	showTrackedChanges: boolean;
	showUploadButton?: boolean;
	toolbarActions?: React.ReactNode;
	zoomLevel: ViewerZoomLevel;
}) {
	const labels = useDocumentViewerLabels();
	const leading = useDocumentViewerToolbarLeading();
	const canZoomIn = resolvedZoom < ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1];
	const canZoomOut = resolvedZoom > ZOOM_OPTIONS[0];
	const selectValue = typeof zoomLevel === "number" ? zoomLevel.toString() : zoomLevel;
	const roundedZoom = Number(resolvedZoom.toFixed(2));
	const zoomOptions = ZOOM_OPTIONS.includes(roundedZoom as (typeof ZOOM_OPTIONS)[number])
		? ZOOM_OPTIONS
		: [...ZOOM_OPTIONS, roundedZoom].sort((left, right) => left - right);
	return (
		<div className='flex min-h-12 items-center justify-between gap-2 max-md:flex-wrap border-b bg-background px-3 py-2'>
			<TooltipProvider>
				<div className='flex min-w-0 items-center gap-2'>
					{leading}
					<ToolbarTooltip label={labels.toggleThumbnails}>
						<Button
							type='button'
							variant='ghost'
							size='icon-sm'
							aria-label={labels.toggleThumbnails}
							disabled={controlsDisabled}
							onClick={onToggleSidebar}
						>
							<HugeiconsIcon icon={SidebarLeftIcon} strokeWidth={1.75} className='size-4' />
						</Button>
					</ToolbarTooltip>
					<DocxPageNumberControl
						activePageStore={activePageStore}
						controlsDisabled={controlsDisabled}
						onPageChange={onPageChange}
						pageCount={pageCount}
					/>
				</div>
				<div className='ms-auto flex shrink-0 items-center justify-end gap-1 max-md:w-full'>
					<div className='flex flex-none items-center gap-1'>
						<ToolbarTooltip label={labels.zoomOut}>
							<Button
								type='button'
								variant='ghost'
								size='icon-sm'
								disabled={controlsDisabled || !canZoomOut}
								aria-label={labels.zoomOut}
								onClick={() => onZoomChange(getNextZoomScale(resolvedZoom, -1))}
							>
								<HugeiconsIcon icon={MinusSignCircleIcon} strokeWidth={1.75} className='size-4' />
							</Button>
						</ToolbarTooltip>
						<Select
							value={selectValue}
							onValueChange={(value) => {
								if (value === null) return;
								onZoomChange(isZoomMode(value) ? value : Number(value));
							}}
							disabled={controlsDisabled}
							modal={false}
						>
							<SelectTrigger
								size='sm'
								className='w-[104px] min-w-[104px] max-md:hidden'
								aria-label={labels.zoomLevel}
							>
								<SelectValue>{Math.round(resolvedZoom)}%</SelectValue>
							</SelectTrigger>
							<SelectContent align='end' alignItemWithTrigger={false}>
								{Object.entries(ZOOM_MODE_LABELS).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
								{zoomOptions.map((value) => (
									<SelectItem key={value} value={value.toString()}>
										{value}%
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<ToolbarTooltip label={labels.zoomIn}>
							<Button
								type='button'
								variant='ghost'
								size='icon-sm'
								disabled={controlsDisabled || !canZoomIn}
								aria-label={labels.zoomIn}
								onClick={() => onZoomChange(getNextZoomScale(resolvedZoom, 1))}
							>
								<HugeiconsIcon icon={PlusSignCircleIcon} strokeWidth={1.75} className='size-4' />
							</Button>
						</ToolbarTooltip>
					</div>
					{toolbarActions ? (
						<>
							<Separator orientation='vertical' className='mx-1 h-4 self-center' />
							{toolbarActions}
						</>
					) : null}
					<Separator orientation='vertical' className='mx-1 h-4 self-center' />
					<DocxFileActionsMenu
						controlsDisabled={controlsDisabled}
						downloadDisabled={controlsDisabled || isPreparingDownload}
						isPreparingDownload={isPreparingDownload}
						onDownload={onDownload}
						onShowCommentsChange={onShowCommentsChange}
						onShowTrackedChangesChange={onShowTrackedChangesChange}
						onUploadClick={onUploadClick}
						showComments={showComments}
						showDownloadButton={showDownloadButton}
						showTrackedChanges={showTrackedChanges}
						showUploadButton={showUploadButton}
					/>
				</div>
			</TooltipProvider>
		</div>
	);
}
function DocxSidebarThumbnail({ isActive, thumbnail }: { isActive: boolean; thumbnail: DocxPageThumbnailItem }) {
	const isLoading = thumbnail.status !== "ready" && thumbnail.status !== "error";
	return (
		<div
			className={`group overflow-hidden rounded-lg border bg-background text-foreground ${cn("w-[92px] rounded-md border-0 shadow-xs ring-0 transition-shadow duration-150", isActive && "shadow-sm")}`}
		>
			<div
				className='relative aspect-square overflow-hidden bg-muted [contain:layout_paint] rounded-md bg-white'
				style={thumbnail.aspectRatio ? { aspectRatio: String(thumbnail.aspectRatio) } : undefined}
			>
				<div
					className={cn(
						"absolute inset-0 size-full transition-[opacity,filter] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
						isLoading ? "opacity-0 blur-sm" : "blur-0 opacity-100"
					)}
				>
					<canvas
						ref={thumbnail.canvasRef}
						width={thumbnail.pixelWidthPx}
						height={thumbnail.pixelHeightPx}
						className='!size-full bg-white object-cover object-top'
					/>
				</div>
				{isLoading ? (
					<div aria-hidden='true' className='absolute inset-0 z-10 overflow-hidden bg-muted'>
						<div className='absolute inset-0 bg-muted' />
						<div className='absolute inset-0 animate-pulse bg-background/55 motion-reduce:animate-none' />
					</div>
				) : null}
				{!isLoading && thumbnail.status === "error" ? (
					<div className='absolute inset-0 bg-muted' aria-hidden='true' />
				) : null}
			</div>
		</div>
	);
}
function DocxThumbnailSidebarList({
	activePage,
	isLoadingDocument,
	onSelectPage,
	onThumbnailRenderWindowChange,
	pageCount,
	sidebarOpen,
	thumbnails,
}: {
	activePage: number;
	isLoadingDocument: boolean;
	onSelectPage: (pageNumber: number) => void;
	onThumbnailRenderWindowChange: (renderWindow: DocxThumbnailRenderWindowState) => void;
	pageCount: number;
	sidebarOpen: boolean;
	thumbnails: DocxPageThumbnailItem[];
}) {
	const labels = useDocumentViewerLabels();
	const viewportRef = React.useRef<HTMLDivElement | null>(null);
	const thumbnailListboxId = React.useId();
	const visibleThumbnails = React.useMemo(() => thumbnails.slice(0, pageCount || 0), [pageCount, thumbnails]);
	const activeDescendantId =
		activePage > 0 && visibleThumbnails.length ? `${thumbnailListboxId}-page-${activePage}` : undefined;
	const virtualizer = useVirtualizer({
		count: visibleThumbnails.length,
		estimateSize: () => DOCX_THUMBNAIL_ROW_ESTIMATE,
		getItemKey: (index) => visibleThumbnails[index]?.pageIndex ?? index,
		getScrollElement: () => viewportRef.current,
		overscan: 3,
	});
	const virtualItems = virtualizer.getVirtualItems();
	const renderWindowSignature = virtualItems.map((virtualRow) => virtualRow.index).join(",");
	React.useEffect(() => {
		if (!sidebarOpen || isLoadingDocument || !visibleThumbnails.length) {
			onThumbnailRenderWindowChange({
				prefetchPageIndexes: [],
				visiblePageIndexes: [],
			});
			return;
		}
		const visiblePageIndexes = virtualItems
			.map((virtualRow) => visibleThumbnails[virtualRow.index]?.pageIndex)
			.filter((pageIndex): pageIndex is number => pageIndex !== undefined);
		const firstVirtualIndex = virtualItems[0]?.index ?? 0;
		const lastVirtualIndex = virtualItems[virtualItems.length - 1]?.index ?? firstVirtualIndex;
		const firstPrefetchIndex = Math.max(0, firstVirtualIndex - DOCX_THUMBNAIL_PREFETCH_ROWS);
		const lastPrefetchIndex = Math.min(
			visibleThumbnails.length - 1,
			lastVirtualIndex + DOCX_THUMBNAIL_PREFETCH_ROWS
		);
		const visiblePageIndexSet = new Set(visiblePageIndexes);
		const prefetchPageIndexes: number[] = [];
		for (let index = firstPrefetchIndex; index <= lastPrefetchIndex; index += 1) {
			const pageIndex = visibleThumbnails[index]?.pageIndex;
			if (pageIndex !== undefined && !visiblePageIndexSet.has(pageIndex)) {
				prefetchPageIndexes.push(pageIndex);
			}
		}
		onThumbnailRenderWindowChange({
			prefetchPageIndexes,
			visiblePageIndexes,
		});
	}, [
		isLoadingDocument,
		onThumbnailRenderWindowChange,
		renderWindowSignature,
		sidebarOpen,
		visibleThumbnails,
		virtualItems,
	]);
	React.useEffect(() => {
		if (!sidebarOpen || activePage < 1 || !visibleThumbnails.length) return;
		virtualizer.scrollToIndex(Math.min(activePage - 1, visibleThumbnails.length - 1), { align: "auto" });
	}, [activePage, sidebarOpen, virtualizer, visibleThumbnails.length]);
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (pageCount < 1) return;
			const currentPage = activePage > 0 ? activePage : 1;
			let nextPage: number | null = null;
			if (event.key === "ArrowDown") {
				nextPage = Math.min(pageCount, currentPage + 1);
			} else if (event.key === "ArrowUp") {
				nextPage = Math.max(1, currentPage - 1);
			} else if (event.key === "Home") {
				nextPage = 1;
			} else if (event.key === "End") {
				nextPage = pageCount;
			}
			if (nextPage === null) return;
			event.preventDefault();
			onSelectPage(nextPage);
		},
		[activePage, onSelectPage, pageCount]
	);
	return (
		<ViewerScrollArea
			className='h-full'
			scrollFade
			viewportClassName='group/docx-thumbnail-sidebar focus-visible:ring-0 focus-visible:ring-offset-0'
			viewportProps={{
				"aria-activedescendant": activeDescendantId,
				"aria-busy": isLoadingDocument || undefined,
				"aria-label": "DOCX pages",
				onKeyDown: handleKeyDown,
				onMouseDown: (event) => {
					event.currentTarget.focus({ preventScroll: true });
				},
				role: "listbox",
				tabIndex: 0,
			}}
			viewportRef={viewportRef}
		>
			{isLoadingDocument ? (
				<div className='p-4'>
					<div className='mx-auto h-28 w-20 overflow-hidden rounded-md bg-background shadow-xs'>
						<div className='h-full animate-pulse bg-muted' />
					</div>
					<div className='mx-auto mt-3 h-3 w-10 rounded-full bg-muted' />
				</div>
			) : visibleThumbnails.length ? (
				<div
					className='relative'
					style={{
						height: virtualizer.getTotalSize() + DOCX_THUMBNAIL_LIST_PADDING * 2,
					}}
				>
					{virtualItems.map((virtualRow) => {
						const thumbnail = visibleThumbnails[virtualRow.index];
						if (!thumbnail) return null;
						return (
							<div
								key={virtualRow.key}
								ref={virtualizer.measureElement}
								data-index={virtualRow.index}
								className={cn(
									"absolute top-0 right-3 left-3 pb-3 [contain:layout]",
									thumbnail.pageNumber === activePage && "z-10"
								)}
								style={{
									transform: `translateY(${virtualRow.start + DOCX_THUMBNAIL_LIST_PADDING}px)`,
								}}
							>
								<div
									id={`${thumbnailListboxId}-page-${thumbnail.pageNumber}`}
									role='option'
									aria-current={thumbnail.pageNumber === activePage ? "page" : undefined}
									aria-label={`${labels.page} ${thumbnail.pageNumber}`}
									aria-posinset={thumbnail.pageNumber}
									aria-selected={thumbnail.pageNumber === activePage}
									aria-setsize={pageCount}
									data-docx-viewer-thumbnail-option={thumbnail.pageNumber}
									className={cn(
										"flex h-auto w-full cursor-default flex-col items-center gap-2 rounded-md p-2 text-xs transition-shadow outline-none select-none hover:bg-sidebar-accent",
										thumbnail.pageNumber === activePage && "bg-sidebar-accent text-foreground",
										thumbnail.pageNumber !== activePage && "text-muted-foreground",
										thumbnail.pageNumber === activePage && DOCX_THUMBNAIL_FOCUS_RING_CLASS
									)}
									tabIndex={0}
									onClick={() => onSelectPage(thumbnail.pageNumber)}
									onKeyDown={(event) => {
										if (event.key !== "Enter" && event.key !== " ") return;
										event.preventDefault();
										onSelectPage(thumbnail.pageNumber);
									}}
								>
									<DocxSidebarThumbnail
										isActive={thumbnail.pageNumber === activePage}
										thumbnail={thumbnail}
									/>
									{thumbnail.pageNumber}
								</div>
							</div>
						);
					})}
				</div>
			) : null}
		</ViewerScrollArea>
	);
}
function DocxThumbnailSidebarContent({
	activePageStore,
	editor,
	isLoadingDocument,
	onSelectPage,
	pageCount,
	reportedPageCount,
	sidebarOpen,
}: {
	activePageStore: DocxActivePageStore;
	editor: DocxEditorController;
	isLoadingDocument: boolean;
	onSelectPage: (pageNumber: number) => void;
	pageCount: number;
	reportedPageCount: number;
	sidebarOpen: boolean;
}) {
	const [thumbnailRenderWindow, setThumbnailRenderWindow] = React.useState<DocxThumbnailRenderWindowState>({
		prefetchPageIndexes: [],
		visiblePageIndexes: [],
	});
	const thumbnailEditor = React.useMemo<DocxEditorController>(
		() => ({
			...editor,
			totalPages: Math.max(editor.totalPages, reportedPageCount),
		}),
		[editor, reportedPageCount]
	);
	const thumbnailOptions = React.useMemo(
		() => ({
			// Detached thumbnail rendering handles offscreen pages; keep the raster
			// queue dormant while the sidebar is closed.
			disabled: !sidebarOpen,
			pixelRatio: 2,
			renderWindow: thumbnailRenderWindow,
			resolution: {
				maxHeight: DOCX_THUMBNAIL_WIDTH * 1.35,
				maxWidth: DOCX_THUMBNAIL_WIDTH,
			},
		}),
		[sidebarOpen, thumbnailRenderWindow]
	);
	const { thumbnails } = useDocxViewerThumbnails(thumbnailEditor, thumbnailOptions);
	const activePage = useDocxActivePage(activePageStore);
	const handleThumbnailRenderWindowChange = React.useCallback((nextRenderWindow: DocxThumbnailRenderWindowState) => {
		setThumbnailRenderWindow((currentRenderWindow) => {
			if (
				areNumberArraysEqual(currentRenderWindow.visiblePageIndexes, nextRenderWindow.visiblePageIndexes) &&
				areNumberArraysEqual(currentRenderWindow.prefetchPageIndexes, nextRenderWindow.prefetchPageIndexes)
			) {
				return currentRenderWindow;
			}
			return nextRenderWindow;
		});
	}, []);
	if (!sidebarOpen) return null;
	return (
		<DocxThumbnailSidebarList
			activePage={activePage}
			isLoadingDocument={isLoadingDocument}
			onSelectPage={onSelectPage}
			onThumbnailRenderWindowChange={handleThumbnailRenderWindowChange}
			pageCount={pageCount}
			sidebarOpen={sidebarOpen}
			thumbnails={thumbnails}
		/>
	);
}
export function DocxViewerPreview({
	className,
	defaultZoom = DEFAULT_ZOOM,
	fileName,
	isDark: effectiveIsDark,
	showDownload = true,
	showUpload = true,
	src: url,
	toolbarActions,
}: {
	className?: string;
	defaultZoom?: ViewerZoomLevel;
	fileName?: string;
	isDark: boolean;
	showDownload?: boolean;
	showUpload?: boolean;
	src?: string;
	toolbarActions?: React.ReactNode;
}) {
	const labels = useDocumentViewerLabels();
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	const viewportRef = React.useRef<HTMLDivElement | null>(null);
	const [viewportElement, setViewportElement] = React.useState<HTMLDivElement | null>(null);
	const [viewerShellRef, viewerShellWidth] = useElementWidth<HTMLDivElement>();
	const [uploadedDocxFile, setUploadedDocxFile] = React.useState<UploadedDocxFile | null>(null);
	const [sidebarOpen, setSidebarOpen] = React.useState(false);
	const activePageStore = React.useMemo(() => createDocxActivePageStore(), []);
	const activeUploadedDocxFile = uploadedDocxFile?.sourceUrl === url ? uploadedDocxFile : null;
	const documentKey = activeUploadedDocxFile?.identity ?? url ?? "";
	const setActivePage = activePageStore.setActivePage;
	const sidebarInline = viewerShellWidth >= 768;
	const viewerBackgroundColor = "color-mix(in oklab, var(--muted) 40%, transparent)";
	const displayFileName = React.useMemo(
		() =>
			activeUploadedDocxFile?.file.name ??
			(url ? formatFileName(fileName, url, "document.docx") : (fileName ?? "document.docx")),
		[activeUploadedDocxFile?.file.name, fileName, url]
	);
	const [initialDocumentTheme] = React.useState<DocxDocumentTheme>(() => (effectiveIsDark ? "dark" : "light"));
	const editorOptions = React.useMemo(
		() => ({
			initialDocumentTheme,
			initialFileName: displayFileName,
		}),
		[displayFileName, initialDocumentTheme]
	);
	const editor = useDocxEditor(editorOptions);
	const { layout: pageLayout } = useDocxPageLayout(editor);
	const { importDocxFile, setDocumentTheme, status } = editor;
	const { showComments, setShowComments } = useDocxComments(editor);
	const { showTrackedChanges, setShowTrackedChanges } = useDocxTrackChanges(editor);
	const [reportedPageCount, setReportedPageCount] = React.useState(0);
	const [zoomState, setZoomState] = React.useState({
		documentKey: "",
		level: defaultZoom,
		resolvedZoom: typeof defaultZoom === "number" ? defaultZoom : DEFAULT_ZOOM,
	});
	const activeZoomState =
		zoomState.documentKey === documentKey
			? zoomState
			: {
					documentKey,
					level: defaultZoom,
					resolvedZoom: typeof defaultZoom === "number" ? defaultZoom : DEFAULT_ZOOM,
				};
	const setZoomLevel = React.useCallback(
		(level: ViewerZoomLevel) => {
			setZoomState({
				documentKey,
				level,
				resolvedZoom: typeof level === "number" ? level : activeZoomState.resolvedZoom,
			});
		},
		[activeZoomState.resolvedZoom, documentKey]
	);
	const handleZoomChange = React.useCallback(
		(state: ViewerZoomState) => {
			setZoomState({ documentKey, ...state });
		},
		[documentKey]
	);
	const [loadError, setLoadError] = React.useState<string>();
	const [isLoadingDocument, setIsLoadingDocument] = React.useState(true);
	const [isPreparingDownload, setIsPreparingDownload] = React.useState(false);
	const shouldShowDocumentSpinner = useDelayedLoadingIndicator(isLoadingDocument);
	const loadingState = <ViewerLoadingSurface showSpinner={shouldShowDocumentSpinner} />;
	const documentTheme = effectiveIsDark ? "dark" : "light";
	const renderTrackedChangeCard = React.useMemo(
		() => createDocxTrackedChangeCardRenderer(documentTheme),
		[documentTheme]
	);
	const renderCommentCard = React.useMemo(() => createDocxCommentCardRenderer(documentTheme), [documentTheme]);
	const hasDocument = Boolean(url || activeUploadedDocxFile);
	const pageCount =
		hasDocument && !isLoadingDocument && !loadError ? Math.max(1, reportedPageCount || editor.totalPages) : 0;
	const thumbnailSidebarVisible = Boolean(sidebarOpen && (pageCount || isLoadingDocument));
	const controlsDisabled = !hasDocument || isLoadingDocument || Boolean(loadError);
	const handlePageCountChange = React.useCallback((nextPageCount: number) => {
		setReportedPageCount(Math.max(1, Math.round(nextPageCount || 1)));
	}, []);
	const setViewportRef = React.useCallback((element: HTMLDivElement | null) => {
		viewportRef.current = element;
		setViewportElement(element);
	}, []);
	const pageVirtualization = React.useMemo(
		() => ({
			enabled: true,
			overscan: 1,
			scrollElement: viewportElement,
		}),
		[viewportElement]
	);
	const handleDownload = React.useCallback(async () => {
		if (isPreparingDownload) return;
		if (!activeUploadedDocxFile && !url) return;
		setIsPreparingDownload(true);
		try {
			await downloadDocxFile({
				file: activeUploadedDocxFile?.file,
				fileName: displayFileName,
				url,
			});
		} catch (error) {
			console.error(error);
		} finally {
			setIsPreparingDownload(false);
		}
	}, [activeUploadedDocxFile, displayFileName, isPreparingDownload, url]);
	useSuppressDocxPaddingWarning(!isLoadingDocument && !loadError);
	React.useEffect(() => {
		setActivePage(1);
		viewportRef.current?.scrollTo({ top: 0, left: 0 });
	}, [documentKey, setActivePage]);
	React.useEffect(() => {
		setDocumentTheme(effectiveIsDark ? "dark" : "light");
	}, [effectiveIsDark, setDocumentTheme]);
	React.useEffect(() => {
		if (status.startsWith("Failed to load file") || status === "Only .docx files are supported") {
			const frame = window.requestAnimationFrame(() => {
				setLoadError(status);
				setIsLoadingDocument(false);
			});
			return () => window.cancelAnimationFrame(frame);
		}
		return undefined;
	}, [status]);
	// Imports mutate the shared editor instance; concurrent calls (effect
	// re-runs, StrictMode double-invoke) race inside the parser and surface as
	// bogus "Invalid DOCX ZIP" errors, so every import is chained through here.
	const importQueueRef = React.useRef<Promise<void>>(Promise.resolve());
	React.useEffect(() => {
		let isCurrent = true;
		async function load() {
			// Superseded while queued — let the newest import run instead.
			if (!isCurrent) return;
			if (!activeUploadedDocxFile && !url) {
				setIsLoadingDocument(false);
				setLoadError(undefined);
				setReportedPageCount(0);
				return;
			}
			setIsLoadingDocument(true);
			setLoadError(undefined);
			setReportedPageCount(0);
			try {
				const docxFile =
					activeUploadedDocxFile?.file ?? (url ? await loadDocxFile(url, displayFileName) : null);
				if (!docxFile) return;
				await importDocxFile(docxFile);
				if (isCurrent) {
					setIsLoadingDocument(false);
					setActivePage(1);
					viewportRef.current?.scrollTo({ top: 0, left: 0 });
				}
			} catch (error) {
				if (isCurrent) {
					setLoadError(error instanceof Error ? error.message : "Unknown DOCX load error");
					setIsLoadingDocument(false);
				}
			}
		}
		importQueueRef.current = importQueueRef.current.then(load);
		return () => {
			isCurrent = false;
		};
	}, [activeUploadedDocxFile, displayFileName, importDocxFile, setActivePage, url]);
	const updateActivePageFromViewport = React.useCallback(() => {
		const viewport = viewportRef.current;
		if (!viewport || !pageCount) return;
		const viewportRect = viewport.getBoundingClientRect();
		const viewportCenter = viewportRect.top + viewportRect.height / 2;
		let closestPage = 1;
		let closestDistance = Number.POSITIVE_INFINITY;
		viewport.querySelectorAll<HTMLElement>('[data-docx-page-wrapper="true"][data-index]').forEach((page) => {
			const pageIndex = Number(page.dataset.index);
			if (!Number.isFinite(pageIndex)) return;
			const pageRect = page.getBoundingClientRect();
			const pageCenter = pageRect.top + pageRect.height / 2;
			const distance = Math.abs(pageCenter - viewportCenter);
			if (distance < closestDistance) {
				closestDistance = distance;
				closestPage = pageIndex + 1;
			}
		});
		activePageStore.setActivePage((currentPage) => (currentPage === closestPage ? currentPage : closestPage));
	}, [activePageStore, pageCount]);
	React.useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport || !pageCount) return;
		let frameId = 0;
		const handleScroll = () => {
			window.cancelAnimationFrame(frameId);
			frameId = window.requestAnimationFrame(updateActivePageFromViewport);
		};
		frameId = window.requestAnimationFrame(updateActivePageFromViewport);
		viewport.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			window.cancelAnimationFrame(frameId);
			viewport.removeEventListener("scroll", handleScroll);
		};
	}, [pageCount, updateActivePageFromViewport]);
	const scrollToPage = React.useCallback(
		(pageNumber: number) => {
			const viewport = viewportRef.current;
			const targetPageIndex = pageNumber - 1;
			const page = viewport?.querySelector<HTMLElement>(
				`[data-docx-page-wrapper="true"][data-index="${targetPageIndex}"]`
			);
			setActivePage(pageNumber);
			if (!viewport) return;
			if (!page) {
				const pageStridePx =
					(pageLayout.pageHeightPx + pageLayout.viewportDefaults.pageGapPx) *
					(activeZoomState.resolvedZoom / 100);
				viewport.scrollTo({
					top: Math.max(0, targetPageIndex * pageStridePx - 24),
					behavior: "auto",
				});
				return;
			}
			viewport.scrollTo({
				top: page.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - 24,
				behavior: "auto",
			});
		},
		[pageLayout.pageHeightPx, pageLayout.viewportDefaults.pageGapPx, setActivePage, activeZoomState.resolvedZoom]
	);
	async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		setZoomLevel(defaultZoom);
		setActivePage(1);
		setReportedPageCount(0);
		setUploadedDocxFile({
			file,
			identity: `${file.name}-${file.size}-${file.lastModified}`,
			sourceUrl: url,
		});
	}
	return (
		<div className={cn("flex h-[640px] min-h-0 flex-col overflow-hidden bg-background", className)}>
			<input
				ref={fileInputRef}
				type='file'
				aria-label={labels.upload}
				accept='.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
				className='hidden'
				onChange={handleUpload}
			/>
			<DocxToolbar
				activePageStore={activePageStore}
				controlsDisabled={controlsDisabled}
				isPreparingDownload={isPreparingDownload}
				onDownload={handleDownload}
				onPageChange={scrollToPage}
				onShowCommentsChange={setShowComments}
				onShowTrackedChangesChange={setShowTrackedChanges}
				onToggleSidebar={() => setSidebarOpen((open) => !open)}
				onUploadClick={() => fileInputRef.current?.click()}
				pageCount={pageCount}
				onZoomChange={setZoomLevel}
				showComments={showComments}
				showDownloadButton={showDownload}
				showTrackedChanges={showTrackedChanges}
				showUploadButton={showUpload}
				toolbarActions={toolbarActions}
				resolvedZoom={activeZoomState.resolvedZoom}
				zoomLevel={activeZoomState.level}
			/>
			<div ref={viewerShellRef} className='relative flex min-h-0 flex-1 overflow-hidden bg-muted/30'>
				<DocumentViewerThumbnailSidebar inline={sidebarInline} open={thumbnailSidebarVisible}>
					<DocxThumbnailSidebarContent
						activePageStore={activePageStore}
						editor={editor}
						isLoadingDocument={isLoadingDocument}
						onSelectPage={scrollToPage}
						pageCount={pageCount}
						reportedPageCount={reportedPageCount}
						sidebarOpen={thumbnailSidebarVisible}
					/>
				</DocumentViewerThumbnailSidebar>
				<ViewerScrollArea
					className='min-h-0 flex-1'
					style={{ backgroundColor: viewerBackgroundColor }}
					viewportClassName='px-4 py-6'
					viewportProps={{
						"aria-label": labels.document,
						dir: "ltr",
						onMouseDown: (event) => {
							if (isInteractiveViewerTarget(event.target)) return;
							event.currentTarget.focus({ preventScroll: true });
						},
						tabIndex: 0,
					}}
					viewportRef={setViewportRef}
				>
					{!url && !activeUploadedDocxFile ? (
						<div className='grid h-full min-h-96 place-items-center p-6 text-center'>
							<div className='max-w-md rounded-lg border bg-background p-4 text-sm shadow-xs'>
								<div className='font-medium'>Upload a Word document to preview</div>
								<div className='mt-1 text-muted-foreground'>
									Pass a DOCX URL with the <code>src</code> prop or upload a file.
								</div>
								<div className='mt-1 text-muted-foreground'>
									Legacy <code>.doc</code> support is limited and experimental; convert to DOCX for
									best fidelity.
								</div>
								<Button
									type='button'
									variant='outline'
									size='sm'
									className='mt-4'
									onClick={() => fileInputRef.current?.click()}
								>
									<HugeiconsIcon icon={Upload01Icon} strokeWidth={1.75} className='size-4' />
									Upload Word document
								</Button>
							</div>
						</div>
					) : loadError ? (
						<div className='grid h-full min-h-96 place-items-center p-6 text-center'>
							<div className='max-w-md rounded-lg border bg-background p-4 text-sm text-destructive shadow-xs'>
								<div className='font-medium'>{labels.unableToDisplay}</div>
								<div className='mt-1 text-muted-foreground'>{loadError}</div>
							</div>
						</div>
					) : isLoadingDocument ? (
						loadingState
					) : (
						<div className='flex min-h-full w-max min-w-full justify-center'>
							<div className={cn(effectiveIsDark && "docx-night-reader-shell")}>
								<DocxEditorViewer
									editor={editor}
									mode='read-only'
									zoom={activeZoomState.level}
									onZoomChange={handleZoomChange}
									showTrackedChanges={showTrackedChanges}
									renderTrackedChangeCard={renderTrackedChangeCard}
									showComments={showComments}
									renderCommentCard={renderCommentCard}
									loadingState={loadingState}
									pageBackgroundColor={effectiveIsDark ? "#0a0a0a" : undefined}
									pageGapBackgroundColor={viewerBackgroundColor}
									pageVirtualization={pageVirtualization}
									deferInitialPaginationPaint={false}
									onPageCountChange={handlePageCountChange}
								/>
							</div>
						</div>
					)}
				</ViewerScrollArea>
			</div>
		</div>
	);
}
