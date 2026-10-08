"use client";

import { useId, useState } from "react";

import Image from "next/image";

import { Loading03Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { TextMorph } from "torph/react";

import type { ChatFileAttachment } from "@/components/chat/chat-attachments";
import {
	getFileSizeParts,
	isTextLikeFile,
	LINE_BREAK_REGEX,
	MAX_PREVIEW_BYTES,
} from "@/components/chat/chat-input/chat-attached-file";
import { getFileExtension } from "@starter/documents";
import { Button } from "@starter/ui/components/button";
import { Card } from "@starter/ui/components/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@starter/ui/components/dialog";
import { Skeleton } from "@starter/ui/components/skeleton";
import { cn } from "@starter/ui/lib/utils";

type MutableReference<Value> = { value: Value };

type AttachmentTextLoad = { kind: "loading" } | { content: string; kind: "text"; lines: number } | { kind: "error" };

const TILE_SIZE = { height: 120, minHeight: 120, minWidth: 120, width: 120 } as const;

const IMAGE_PREVIEW_FALLBACK_SIZE = { height: 480, width: 640 } as const;

const getUploadStatusLabel = ({
	t,
	uploadStatus,
}: {
	t: ReturnType<typeof useTranslations<"components.chat.chatInput.attachment">>;
	uploadStatus: ChatFileAttachment["uploadStatus"];
}) => {
	if (uploadStatus === "uploading") {
		return t("uploading");
	}

	if (uploadStatus === "processing") {
		return t("processing");
	}

	if (uploadStatus === "error") {
		return t("uploadFailed");
	}

	return null;
};

const getAttachmentDetailLine = ({
	canCountLines,
	lineCountLabel,
	size,
	sizeLabel,
	statusLabel,
	t,
}: {
	canCountLines: boolean;
	lineCountLabel: string | null;
	size: number;
	sizeLabel: string;
	statusLabel: string | null;
	t: ReturnType<typeof useTranslations<"components.chat.chatInput.attachment">>;
}) => {
	if (statusLabel) {
		return statusLabel;
	}

	if (canCountLines) {
		return lineCountLabel;
	}

	if (size === 0) {
		return t("zeroLines");
	}

	return sizeLabel;
};

const readAttachmentText = async ({ signal, url }: { signal: AbortSignal; url: string }) => {
	const response = await fetch(url, { signal });

	if (!response.ok) {
		throw new Error(`Attachment preview failed with status ${response.status}`);
	}

	return response.text();
};

const ChatImagePreviewDialog = ({
	displayName,
	onOpenChange,
	open,
	preview,
}: {
	displayName: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	preview: string;
}) => {
	const t = useTranslations("components.chat.chatInput.attachment");
	const [naturalSize, setNaturalSize] = useState<{ height: number; width: number }>(IMAGE_PREVIEW_FALLBACK_SIZE);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				className='pointer-events-none max-w-160 sm:max-w-160'
				padding='none'
				showCloseButton={false}
				variant='transparent'
			>
				<DialogTitle className='sr-only'>{t("previewTitle", { name: displayName })}</DialogTitle>

				<div className='pointer-events-auto relative mx-auto w-fit'>
					<DialogClose
						render={
							<Button
								aria-label={t("closeImagePreview")}
								className='absolute top-2 end-2 z-10'
								data-testid='close-file-preview'
								size='icon-sm'
								type='button'
								variant='ghost'
							>
								<HugeiconsIcon
									aria-hidden
									className='scale-110'
									icon={Cancel01Icon}
									strokeWidth={1.75}
								/>
							</Button>
						}
					/>

					<div
						className='relative max-w-full overflow-hidden smooth-shadow-xl'
						style={{
							aspectRatio: `${naturalSize.width} / ${naturalSize.height}`,
							borderRadius: 6,
							maxHeight: "calc(100vh - 7rem)",
							width: `min(${Math.min(naturalSize.width, IMAGE_PREVIEW_FALLBACK_SIZE.width)}px, calc(100vw - 2rem))`,
						}}
					>
						<Image
							alt={t("previewAlt", { name: displayName })}
							className='object-contain'
							fill
							onLoad={(event) => {
								setNaturalSize({
									height: event.currentTarget.naturalHeight,
									width: event.currentTarget.naturalWidth,
								});
							}}
							priority
							sizes='(max-width: 768px) calc(100vw - 2rem), 40rem'
							src={preview}
							unoptimized
						/>
					</div>
				</div>

				<div className='wrap-anywhere pointer-events-none relative z-10 pt-1.5 text-center text-sm text-background drop-shadow-md'>
					{displayName}
				</div>
			</DialogContent>
		</Dialog>
	);
};

const ChatAttachmentPreviewDialog = ({
	attachment,
	displayName,
	onOpenChange,
	open,
	textLoad,
}: {
	attachment: ChatFileAttachment;
	displayName: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	textLoad: AttachmentTextLoad;
}) => {
	const t = useTranslations("components.chat.chatInput.attachment");
	const tSize = useTranslations("components.chat.chatInput.fileSize");
	const { filename, mediaType, size } = attachment;
	const canPreviewText = isTextLikeFile({ filename, mediaType }) && size <= MAX_PREVIEW_BYTES;
	const sizeParts = getFileSizeParts(size);
	const sizeLabel = sizeParts.unit === "zero" ? tSize("zero") : tSize(sizeParts.unit, { size: sizeParts.size });

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				className='flex max-h-[min(90vh,calc(100%-2rem))] max-w-[calc(100%-2rem)] flex-col overflow-hidden text-start'
				showCloseButton={false}
				size='xl'
				variant='default'
			>
				<div className='flex min-h-0 min-w-0 flex-1 flex-col'>
					<div className='flex shrink-0 items-start justify-between gap-4'>
						<DialogTitle className='wrap-anywhere w-full min-w-0' size='sm'>
							{displayName}
						</DialogTitle>
						<DialogClose
							render={
								<Button
									aria-label={t("close")}
									className='-me-2'
									size='icon-sm'
									type='button'
									variant='ghost'
								>
									<HugeiconsIcon
										aria-hidden
										className='scale-110'
										icon={Cancel01Icon}
										strokeWidth={1.75}
									/>
								</Button>
							}
						/>
					</div>

					<DialogDescription className='mt-0.5 mb-2 shrink-0'>
						<span className='flex flex-wrap items-center gap-y-2 text-xs'>
							<span className='text-muted-foreground'>
								{canPreviewText && textLoad.kind !== "error" ? (
									<span>
										{sizeLabel}
										<span aria-hidden className='mx-1 opacity-50'>
											•
										</span>
										{textLoad.kind === "text" ? (
											t("lineCount", { count: textLoad.lines })
										) : (
											<span className='animate-pulse'>…</span>
										)}
									</span>
								) : (
									<span>{sizeLabel}</span>
								)}
							</span>
							{canPreviewText && textLoad.kind !== "error" ? (
								<>
									<span aria-hidden className='mx-1.5 hidden opacity-50 lg:inline'>
										•
									</span>
									<span className='text-muted-foreground'>{t("formattingDisclaimer")}</span>
								</>
							) : null}
						</span>
					</DialogDescription>

					<div className='min-h-0 flex-1 overflow-hidden'>
						{canPreviewText && textLoad.kind === "loading" && (
							<div aria-label={t("loadingPreview")} className='space-y-3 p-4' role='status'>
								<Skeleton className='h-4 w-full' />
								<Skeleton className='h-4 w-full' />
								<Skeleton className='h-4 w-full' />
							</div>
						)}

						{canPreviewText && textLoad.kind === "text" && (
							<div className='max-h-[min(60vh,480px)] min-h-[120px] overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-card p-4 font-mono text-foreground text-xs smooth-shadow-ring-sm'>
								{textLoad.content}
							</div>
						)}

						{(!canPreviewText || textLoad.kind === "error") && (
							<div className='rounded-lg border border-border/40 bg-muted/30 p-4 font-mono text-muted-foreground text-xs'>
								{t("previewUnavailable")}
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};

type ChatAttachmentTileProps = {
	attachment: ChatFileAttachment;
	disabled?: boolean;
	onRemove: (id: string) => void;
};

const ChatAttachmentContent = ({
	attachment,
	canCountLines,
	detailLine,
	displayName,
	extLabel,
	hasError,
	isPending,
	lineCountLabel,
	onOpenChange,
	open,
	preview,
	statusLabel,
	textLoad,
	titleId,
}: {
	attachment: ChatFileAttachment;
	canCountLines: boolean;
	detailLine: string | null;
	displayName: string;
	extLabel: string;
	hasError: boolean;
	isPending: boolean;
	lineCountLabel: string | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	preview: string | null;
	statusLabel: string | null;
	textLoad: AttachmentTextLoad;
	titleId: string;
}) => {
	const locale = useLocale();
	const t = useTranslations("components.chat.chatInput.attachment");

	const pendingOverlay = isPending ? (
		<div
			aria-live='polite'
			className='absolute inset-0 z-10 grid place-items-center bg-foreground/10 backdrop-blur-[1px]'
			role='status'
		>
			<HugeiconsIcon
				aria-hidden
				className='size-5 animate-spin text-foreground/70 scale-110'
				icon={Loading03Icon}
				strokeWidth={1.75}
			/>
			<span className='sr-only'>{statusLabel}</span>
		</div>
	) : null;

	return (
		<>
			{preview ? (
				<ChatImagePreviewDialog
					displayName={displayName}
					onOpenChange={onOpenChange}
					open={open}
					preview={preview}
				/>
			) : (
				<ChatAttachmentPreviewDialog
					attachment={attachment}
					displayName={displayName}
					onOpenChange={onOpenChange}
					open={open}
					textLoad={textLoad}
				/>
			)}
			{preview ? (
				<Button
					aria-label={t("preview", { name: displayName })}
					className='relative block'
					onClick={() => onOpenChange(true)}
					style={TILE_SIZE}
					type='button'
					unstyled
				>
					{pendingOverlay}
					<div className='relative size-full overflow-hidden rounded-lg smooth-shadow-sm'>
						<Image
							alt={displayName}
							className='object-cover'
							fill
							sizes='120px'
							src={preview}
							unoptimized
						/>
					</div>
				</Button>
			) : (
				<Button
					aria-label={t("cardSummary", {
						details: [extLabel, detailLine].filter(Boolean).join(", "),
						name: displayName,
					})}
					className='relative block text-start'
					onClick={() => onOpenChange(true)}
					style={TILE_SIZE}
					type='button'
					unstyled
				>
					<Card className='relative size-full justify-between overflow-hidden' variant='attachment'>
						{pendingOverlay}
						<div className='flex min-h-0 flex-col gap-1'>
							<h3
								className='wrap-anywhere line-clamp-3 text-[12px] text-foreground leading-snug'
								id={titleId}
							>
								{displayName}
							</h3>
							<p
								className={cn(
									"wrap-break-word line-clamp-1 text-[10px] leading-normal",
									hasError ? "text-destructive" : "text-muted-foreground",
									!statusLabel &&
										canCountLines &&
										lineCountLabel === null &&
										"animate-pulse opacity-70"
								)}
							>
								<TextMorph disabled={locale === "ar"} duration={200} locale={locale}>
									{!statusLabel && canCountLines && lineCountLabel === null
										? "…"
										: (detailLine ?? "")}
								</TextMorph>
							</p>
						</div>
						<div className='relative flex min-h-0 flex-row items-center justify-between gap-1'>
							<div className='flex min-w-0 shrink flex-row gap-1'>
								<div className='flex h-[18px] min-w-0 shrink flex-row items-center justify-center gap-0.5 rounded bg-background/70 px-1 font-medium smooth-shadow-sm backdrop-blur-sm transition-[border-color,box-shadow,opacity,background-color] duration-200 ease-[var(--ease-out-quint)]'>
									<p className='truncate font-sans text-[11px] text-foreground/90 uppercase leading-[13px]'>
										{extLabel.slice(0, 6).toUpperCase()}
									</p>
								</div>
							</div>
						</div>
					</Card>
				</Button>
			)}
		</>
	);
};

export const ChatAttachmentTile = ({ attachment, disabled = false, onRemove }: ChatAttachmentTileProps) => {
	const t = useTranslations("components.chat.chatInput.attachment");
	const tSize = useTranslations("components.chat.chatInput.fileSize");
	const { filename, id, mediaType, size, uploadStatus, url } = attachment;
	const isImage = mediaType.startsWith("image/");
	const preview = isImage ? url : null;
	const displayName = filename;
	const titleId = useId();
	const [previewOpen, setPreviewOpen] = useState(false);

	const isPending = uploadStatus === "uploading" || uploadStatus === "processing";
	const hasError = uploadStatus === "error";
	const sizeParts = getFileSizeParts(size);
	const sizeLabel = sizeParts.unit === "zero" ? tSize("zero") : tSize(sizeParts.unit, { size: sizeParts.size });
	const canCountLines = !isImage && size > 0 && isTextLikeFile({ filename, mediaType }) && size <= MAX_PREVIEW_BYTES;
	const canPreviewText = !isImage && isTextLikeFile({ filename, mediaType }) && size <= MAX_PREVIEW_BYTES;
	const statusLabel = getUploadStatusLabel({ t, uploadStatus });

	const textQuery = useQuery({
		enabled: canCountLines || (canPreviewText && previewOpen),
		queryFn: ({ signal }) => readAttachmentText({ signal, url }),
		queryKey: ["chat-attachment-text", id, url],
		retry: false,
		staleTime: Infinity,
	});

	const textLoadReference: MutableReference<AttachmentTextLoad> = { value: { kind: "loading" } };

	if (textQuery.isError) {
		textLoadReference.value = { kind: "error" };
	} else if (textQuery.data !== undefined) {
		textLoadReference.value = {
			content: textQuery.data,
			kind: "text",
			lines: textQuery.data.split(LINE_BREAK_REGEX).length,
		};
	}

	const lineCountLabelReference: MutableReference<string | null> = { value: null };

	if (canCountLines && textLoadReference.value.kind === "text") {
		lineCountLabelReference.value = t("lineCount", { count: textLoadReference.value.lines });
	} else if (canCountLines && textLoadReference.value.kind === "error") {
		lineCountLabelReference.value = sizeLabel;
	}

	const detailLine = getAttachmentDetailLine({
		canCountLines,
		lineCountLabel: lineCountLabelReference.value,
		size,
		sizeLabel,
		statusLabel,
		t,
	});

	const extLabel = getFileExtension({ filename, mediaType }) || t("fileExtensionFallback");

	return (
		<div
			className='group/thumbnail group/button-reveal relative shrink-0'
			data-composer-attachment
			data-testid='file-thumbnail'
		>
			<ChatAttachmentContent
				attachment={attachment}
				canCountLines={canCountLines}
				detailLine={detailLine}
				displayName={displayName}
				extLabel={extLabel}
				hasError={hasError}
				isPending={isPending}
				lineCountLabel={lineCountLabelReference.value}
				onOpenChange={setPreviewOpen}
				open={previewOpen}
				preview={preview}
				statusLabel={statusLabel}
				textLoad={textLoadReference.value}
				titleId={titleId}
			/>
			<Button
				aria-describedby={preview ? undefined : titleId}
				aria-label={t("remove")}
				className='absolute -top-2 -start-2 z-20'
				data-composer-attachment
				disabled={disabled}
				hideWhenDisabled
				onClick={(e) => {
					e.stopPropagation();
					onRemove(id);
				}}
				revealOnHover
				size='icon-xs'
				type='button'
				variant='ghost'
			>
				<HugeiconsIcon aria-hidden className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
			</Button>
		</div>
	);
};
