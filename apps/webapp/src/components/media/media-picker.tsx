"use client";

import { useState } from "react";

import Image from "next/image";

import { Delete02Icon, ImageAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient } from "@/lib/api-client";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@starter/ui/components/alert-dialog";
import { Button } from "@starter/ui/components/button";
import { Card } from "@starter/ui/components/card";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "@starter/ui/components/dialog";
import { Input } from "@starter/ui/components/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@starter/ui/components/tabs";
import { cn } from "@starter/ui/lib/utils";

import { LogoGenerator } from "./logo-generator";
import { MediaEditButton } from "./media-edit-button";
import { useMediaUpload, type UploadedMedia } from "./use-media-upload";

const MediaDeleteDialog = ({
	onClose,
	onDeleted,
	target,
}: {
	onClose: () => void;
	onDeleted: (mediaId: string) => void;
	target: UploadedMedia | null;
}) => {
	const t = useTranslations("media");
	const tc = useTranslations("common");
	const queryClient = useQueryClient();

	const remove = useMutation(
		apiClient.media.delete.mutationOptions({
			onSuccess: async ({ id }) => {
				onDeleted(id);
				onClose();
				await queryClient.invalidateQueries({ queryKey: apiClient.media.list.key() });
			},
		})
	);

	const close = () => {
		remove.reset();
		onClose();
	};

	return (
		<AlertDialog
			onOpenChange={(open) => {
				if (!open && !remove.isPending) {
					close();
				}
			}}
			open={target !== null}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("deleteDescription", { name: target?.name ?? "" })}
					</AlertDialogDescription>
				</AlertDialogHeader>
				{remove.isError && (
					<p className='text-sm text-destructive' role='alert'>
						{t("deleteFailed")}
					</p>
				)}
				<AlertDialogFooter>
					<Button disabled={remove.isPending} onClick={close} variant='secondary'>
						{tc("cancel")}
					</Button>
					<Button
						loading={remove.isPending}
						onClick={() => target && remove.mutate({ mediaId: target.id })}
						variant='destructive'
					>
						{tc("delete")}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};

type MediaPickerContentProps = {
	disabled?: boolean;
	kind?: "image" | "video";
	onSelect: (media: UploadedMedia) => Promise<void>;
	purpose?: "logo";
};

const UploadedMediaPickerContent = ({ disabled = false, kind, onSelect, purpose }: MediaPickerContentProps) => {
	const t = useTranslations("media");
	const { can } = useOrganizationPermissions();
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<UploadedMedia | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<UploadedMedia | null>(null);
	const [saving, setSaving] = useState(false);
	const upload = useMediaUpload({ kind, purpose });

	const library = useInfiniteQuery(
		apiClient.media.list.infiniteOptions<number>({
			getNextPageParam: (page) => page.nextOffset ?? undefined,
			initialPageParam: 0,
			input: (offset) => ({ kind, offset, purpose, query, semantic: query.trim().length > 0 }),
		})
	);

	const busy = disabled || upload.progress !== null || saving;

	const uploadFile = async (file: File | undefined) => {
		if (!file || busy) {
			return;
		}

		const media = await upload.upload(file);

		if (media) {
			setSelected(media);
			library.refetch();
		}
	};

	const items = library.data?.pages.flatMap((page) => page.items) ?? [];

	return (
		<>
			<div className='min-h-0 flex-1 space-y-3 overflow-y-auto'>
				<label
					className='relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm focus-within:outline-2 focus-within:outline-ring has-disabled:opacity-50'
					onDragOver={(event) => event.preventDefault()}
					onDrop={(event) => {
						event.preventDefault();
						uploadFile(event.dataTransfer.files[0]);
					}}
				>
					<HugeiconsIcon
						aria-hidden='true'
						className='size-5 scale-110'
						icon={ImageAdd01Icon}
						strokeWidth={1.75}
					/>
					{t("upload")}
					<Input
						accept={upload.accept}
						aria-label={t("upload")}
						disabled={busy}
						onChange={(event) => {
							uploadFile(event.target.files?.[0]);
							event.target.value = "";
						}}
						type='file'
						variant='overlay'
					/>
					<span className='text-xs text-muted-foreground'>{t(purpose ? "logoLimits" : "limits")}</span>
				</label>
				{upload.progress !== null && (
					<p className='text-sm text-muted-foreground' role='status'>
						{upload.progress === 100
							? t("finishing")
							: t("progress", { percent: Math.round(upload.progress) })}
					</p>
				)}
				{upload.error && (
					<p className='text-sm text-destructive' role='alert'>
						{t(upload.error)}
					</p>
				)}
				<Input
					aria-label={t("search")}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t("search")}
					value={query}
				/>
				<div>
					{library.isPending && (
						<p className='p-4 text-sm text-muted-foreground' role='status'>
							{t("loading")}
						</p>
					)}
					{library.isError && (
						<Button onClick={() => library.refetch()} variant='outline'>
							{t("retry")}
						</Button>
					)}
					{!library.isPending && !library.isError && items.length === 0 && (
						<p className='p-4 text-sm text-muted-foreground'>{t("empty")}</p>
					)}
					<div className='grid grid-cols-2 gap-3'>
						{(selected && !items.some((item) => item.id === selected.id)
							? [selected, ...items]
							: items
						).map((item) => (
							<div className='relative' key={item.id}>
								<Button
									aria-label={item.name}
									aria-pressed={selected?.id === item.id}
									className='group relative block w-full min-w-0'
									disabled={busy}
									onClick={() => setSelected(item)}
									unstyled
								>
									<Card variant='selectable'>
										{item.kind === "video" ? (
											<video
												aria-label={item.name}
												className='aspect-[4/3] w-full rounded object-cover'
												muted
												playsInline
												preload='metadata'
												src={item.url}
											/>
										) : (
											<Image
												alt=''
												className={cn(
													"aspect-[4/3] w-full rounded",
													purpose ? "bg-muted object-contain p-3" : "object-cover"
												)}
												height={240}
												loading='lazy'
												src={item.url}
												unoptimized
												width={320}
											/>
										)}
									</Card>
								</Button>
								{can("workspace.delete") && (
									<Button
										aria-label={t("deleteAction", { name: item.name })}
										className='absolute end-2 top-2 z-10'
										disabled={busy}
										onClick={() => setDeleteTarget(item)}
										size='icon'
										type='button'
										variant='secondary'
									>
										<HugeiconsIcon
											aria-hidden='true'
											className='scale-110'
											icon={Delete02Icon}
											strokeWidth={1.75}
										/>
									</Button>
								)}
							</div>
						))}
					</div>
					{library.hasNextPage && (
						<Button
							className='mt-3 w-full'
							disabled={library.isFetchingNextPage}
							onClick={() => library.fetchNextPage()}
							variant='ghost'
						>
							{t("more")}
						</Button>
					)}
				</div>
			</div>
			<Button
				className='w-full'
				disabled={!selected || busy}
				loading={saving}
				onClick={async () => {
					if (!selected) {
						return;
					}

					setSaving(true);

					try {
						await onSelect(selected);
					} finally {
						setSaving(false);
					}
				}}
				size='lg'
			>
				{t("use")}
			</Button>
			<MediaDeleteDialog
				onClose={() => setDeleteTarget(null)}
				onDeleted={(id) => setSelected((current) => (current?.id === id ? null : current))}
				target={deleteTarget}
			/>
		</>
	);
};

export const MediaPickerContent = (props: MediaPickerContentProps) => {
	const t = useTranslations("media");

	if (!props.purpose) {
		return <UploadedMediaPickerContent {...props} />;
	}

	return (
		<Tabs className='flex min-h-0 flex-1 flex-col' defaultValue='uploads'>
			<TabsList>
				<TabsTrigger value='uploads'>{t("uploads")}</TabsTrigger>
				<TabsTrigger value='generate'>{t("generate")}</TabsTrigger>
			</TabsList>
			<TabsContent className='flex min-h-0 flex-1 flex-col' value='uploads'>
				<UploadedMediaPickerContent {...props} />
			</TabsContent>
			<TabsContent className='flex min-h-0 flex-1 flex-col' value='generate'>
				<LogoGenerator disabled={props.disabled} onSelect={props.onSelect} />
			</TabsContent>
		</Tabs>
	);
};

export const MediaPicker = ({
	disabled = false,
	kind,
	label,
	onRemove,
	onSelect,
	previewUrl,
}: {
	disabled?: boolean;
	kind?: "image" | "video";
	label?: string;
	onRemove?: () => void;
	onSelect: (media: UploadedMedia) => Promise<boolean | void> | boolean | void;
	previewUrl?: string | null;
}) => {
	const t = useTranslations("media");
	const tCommon = useTranslations("common");
	const { can } = useOrganizationPermissions();
	const [open, setOpen] = useState(false);

	return (
		<>
			{previewUrl ? (
				<div className='relative overflow-hidden rounded-xl'>
					<Image
						alt={label ?? ""}
						className='aspect-video w-full object-cover'
						height={180}
						src={previewUrl}
						unoptimized
						width={320}
					/>
					<MediaEditButton
						disabled={disabled || !can("workspace.write")}
						label={label}
						onClick={() => setOpen(true)}
					/>
				</div>
			) : (
				<Button
					disabled={disabled || !can("workspace.write")}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setOpen(true);
					}}
					type='button'
					variant='outline'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={ImageAdd01Icon} strokeWidth={1.75} />
					{label ?? t("choose")}
				</Button>
			)}
			{previewUrl && onRemove && (
				<Button disabled={disabled || !can("workspace.write")} onClick={onRemove} type='button' variant='ghost'>
					{t("remove")}
				</Button>
			)}
			<Dialog onOpenChange={setOpen} open={open}>
				<DialogPopup className='flex max-h-[90dvh] flex-col' closeLabel={tCommon("close")} size='lg'>
					<DialogTitle>{t("title")}</DialogTitle>
					<DialogDescription>{t("description")}</DialogDescription>
					{open && (
						<MediaPickerContent
							kind={kind}
							onSelect={async (media) => {
								if ((await onSelect(media)) !== false) {
									setOpen(false);
								}
							}}
						/>
					)}
				</DialogPopup>
			</Dialog>
		</>
	);
};
