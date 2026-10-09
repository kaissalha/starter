"use client";

import { Fragment, useState } from "react";

import dynamic from "next/dynamic";
import Image from "next/image";

import {
	AiMagicIcon,
	ArrowLeft01Icon,
	Delete02Icon,
	Download04Icon,
	File01Icon,
	InformationCircleIcon,
	MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Link, useRouter } from "@/i18n/navigation";
import { apiClient, client } from "@/lib/api-client";
import { getDocumentViewerKind } from "@starter/documents";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@starter/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";
import { Popover, PopoverPopup, PopoverTrigger } from "@starter/ui/components/popover";
import { type CSSPropertiesWithVariables, SidebarProvider, SidebarTrigger } from "@starter/ui/components/sidebar";
import { Skeleton } from "@starter/ui/components/skeleton";
import { toast } from "@starter/ui/components/toaster";

import { LibraryAgentSidebar } from "./library-agent-sidebar";
import { LibraryGeneratingPreview } from "./library-asset-card";
import { LibraryDocumentEditor } from "./library-document-editor";
import { LibraryVersionStrip } from "./library-version-strip";
import { useFollowNewVersion } from "./use-follow-new-version";
import { type LibraryAssetDetail, useLibraryAssetController } from "./use-library-asset-controller";

const LibraryDocumentViewer = dynamic(
	async () => {
		const { LibraryDocumentViewer: Viewer } = await import("./library-document-viewer");

		return Viewer;
	},
	{ ssr: false }
);

const formatBytes = (format: ReturnType<typeof useFormatter>, bytes: number) =>
	format.number(bytes, {
		maximumFractionDigits: 1,
		notation: "compact",
		style: "unit",
		unit: "byte",
		unitDisplay: "narrow",
	});

const LibraryAssetDetails = ({ asset }: { asset: LibraryAssetDetail }) => {
	const t = useTranslations("library");
	const format = useFormatter();

	const rows = [
		{ label: t("type"), value: asset.contentType },
		{ label: t("size"), value: asset.sizeBytes === null ? null : formatBytes(format, asset.sizeBytes) },
		{ label: t("dimensions"), value: asset.width && asset.height ? `${asset.width} × ${asset.height}` : null },
		{
			label: t("added"),
			value: format.dateTime(new Date(asset.createdAt), { dateStyle: "medium", timeStyle: "short" }),
		},
		{
			label: t("updated"),
			value: format.dateTime(new Date(asset.updatedAt), { dateStyle: "medium", timeStyle: "short" }),
		},
		{ label: t("date"), value: asset.docDate },
		{ label: t("language"), value: asset.language },
		{ label: t("category"), value: asset.category && asset.category !== "unknown" ? asset.category : null },
		{ label: t("model"), value: asset.generation?.model ?? null },
	].filter((row) => row.value);

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button aria-label={t("details")} size='icon-sm' variant='ghost'>
						<HugeiconsIcon className='scale-110' icon={InformationCircleIcon} strokeWidth={1.75} />
					</Button>
				}
			/>
			<PopoverPopup align='end' className='w-80 max-w-[calc(100vw-2rem)]'>
				<div className='grid gap-4 text-sm'>
					<h2 className='font-medium'>{t("details")}</h2>
					{(asset.status === "pending" || asset.status === "failed") && (
						<Badge role='status' variant={asset.status === "failed" ? "critical" : "default"}>
							{t(asset.status === "pending" ? "processing" : "failed")}
						</Badge>
					)}
					{asset.summary && (
						<p className='leading-relaxed text-muted-foreground' dir='auto'>
							{asset.summary}
						</p>
					)}
					{asset.tags.length > 0 && (
						<ul aria-label={t("tags")} className='flex flex-wrap gap-1.5'>
							{asset.tags.map((tag) => (
								<li key={tag}>
									<Badge variant='secondary'>{tag}</Badge>
								</li>
							))}
						</ul>
					)}
					<dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5'>
						{rows.map(({ label, value }) => (
							<Fragment key={label}>
								<dt className='text-muted-foreground'>{label}</dt>
								<dd className='min-w-0 truncate' dir='auto'>
									{value}
								</dd>
							</Fragment>
						))}
					</dl>
					{asset.generation && (
						<div className='grid gap-1'>
							<span className='text-muted-foreground'>{t("prompt")}</span>
							<p className='max-h-32 overflow-y-auto leading-relaxed' dir='auto'>
								{asset.generation.prompt}
							</p>
						</div>
					)}
				</div>
			</PopoverPopup>
		</Popover>
	);
};

const LibraryInlineName = ({
	disabled,
	onChange,
	value,
}: {
	disabled: boolean;
	onChange: (value: string) => void;
	value: string;
}) => {
	const t = useTranslations("library");
	const [initialValue] = useState(value);

	return (
		<span
			aria-label={t("name")}
			className='block min-w-0 truncate rounded-md px-1.5 py-0.5 text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring'
			contentEditable={disabled ? false : "plaintext-only"}
			dir='auto'
			onBlur={(event) => {
				if (!event.currentTarget.textContent?.trim()) {
					event.currentTarget.textContent = initialValue;
				}
			}}
			onInput={(event) => {
				const name = (event.currentTarget.textContent ?? "").slice(0, 200);

				if (event.currentTarget.textContent !== name) {
					event.currentTarget.textContent = name;
				}

				if (name.trim()) {
					onChange(name);
				}
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter" && !event.nativeEvent.isComposing) {
					event.preventDefault();
					event.currentTarget.blur();
				}
			}}
			role={disabled ? undefined : "textbox"}
			suppressContentEditableWarning
			tabIndex={disabled ? -1 : 0}
		>
			{initialValue}
		</span>
	);
};

const LibraryAssetPreview = ({ asset, fileUrl }: { asset: LibraryAssetDetail; fileUrl: string | null }) => {
	const t = useTranslations("library");

	if (asset.generating) {
		return (
			<div className='aspect-square w-full max-w-md overflow-hidden rounded-lg'>
				<LibraryGeneratingPreview label={t("generating")} />
			</div>
		);
	}

	if (asset.kind === "image" && fileUrl) {
		return (
			<Image
				alt={asset.summary ?? asset.name}
				className='max-h-[calc(100dvh-14rem)] w-auto max-w-full rounded-lg object-contain'
				height={asset.height ?? 1024}
				priority
				sizes='(min-width:1024px) 60vw, 100vw'
				src={fileUrl}
				width={asset.width ?? 1024}
			/>
		);
	}

	if (asset.kind === "video" && fileUrl) {
		return (
			<video className='max-h-[calc(100dvh-14rem)] max-w-full rounded-lg' controls playsInline src={fileUrl} />
		);
	}

	return (
		<div className='grid max-w-xl gap-4 text-center'>
			<div className='mx-auto flex size-14 items-center justify-center rounded-xl bg-background text-muted-foreground smooth-shadow-ring-sm'>
				<HugeiconsIcon aria-hidden className='size-6 scale-110' icon={File01Icon} strokeWidth={1.75} />
			</div>
			<p className='text-sm font-medium' dir='auto'>
				{asset.name}
			</p>
			{asset.summary && (
				<p className='text-sm leading-relaxed text-muted-foreground' dir='auto'>
					{asset.summary}
				</p>
			)}
		</div>
	);
};

const detailsSidebarStyle: CSSPropertiesWithVariables = { "--sidebar-width-details": "26rem" };

const LibraryAssetView = ({ asset, onConflict }: { asset: LibraryAssetDetail; onConflict: () => void }) => {
	const { can } = useOrganizationPermissions();
	const t = useTranslations("library");
	const tCommon = useTranslations("common");
	const router = useRouter();
	const queryClient = useQueryClient();
	const controller = useLibraryAssetController({ asset, onConflict });
	const [confirmDelete, setConfirmDelete] = useState(false);

	const remove = useMutation({
		mutationFn: () => client.library.delete({ assetId: asset.id }),
		onError: () => toast.error(tCommon("messages.somethingWentWrong")),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: apiClient.library.list.key() });
			router.push("/dashboard/library");
		},
	});

	const mediaUrl = asset.url;
	const fileUrl = asset.editable ? `/api/library/${asset.id}/pdf?download` : mediaUrl;
	const writable = can("workspace.write");
	const viewerKind = getDocumentViewerKind(asset.contentType);

	const actions = (
		<>
			{asset.editable && (
				<span aria-live='polite' className='text-xs text-muted-foreground'>
					{t(controller.status)}
				</span>
			)}
			<LibraryAssetDetails asset={asset} />
			{(fileUrl || can("workspace.delete")) && (
				<DropdownMenu>
					<DropdownMenuTrigger render={<Button aria-label={t("actions")} size='icon-sm' variant='ghost' />}>
						<HugeiconsIcon aria-hidden className='scale-110' icon={MoreHorizontalIcon} strokeWidth={1.75} />
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end'>
						{fileUrl && (
							<DropdownMenuItem
								render={<a download={asset.name} href={fileUrl} rel='noreferrer' target='_blank' />}
							>
								<HugeiconsIcon
									aria-hidden
									className='scale-110'
									icon={Download04Icon}
									strokeWidth={1.75}
								/>
								{t(asset.editable ? "downloadPdf" : "download")}
							</DropdownMenuItem>
						)}
						{can("workspace.delete") && (
							<DropdownMenuItem onClick={() => setConfirmDelete(true)} variant='destructive'>
								<HugeiconsIcon
									aria-hidden
									className='scale-110'
									icon={Delete02Icon}
									strokeWidth={1.75}
								/>
								{t("delete")}
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			{writable && (
				<SidebarTrigger aria-label={t("agent.open")} className='md:w-auto' purpose='details' size='sm'>
					<HugeiconsIcon className='scale-110' icon={AiMagicIcon} strokeWidth={1.75} />
					<span className='hidden md:inline'>{t("agent.open")}</span>
				</SidebarTrigger>
			)}
		</>
	);

	const leading = (
		<div className='flex min-w-0 items-center gap-2'>
			<Button
				aria-label={t("back")}
				nativeButton={false}
				render={<Link aria-label={t("back")} href='/dashboard/library' />}
				size='icon-sm'
				variant='ghost'
			>
				<HugeiconsIcon className='scale-110' icon={ArrowLeft01Icon} strokeWidth={1.75} />
			</Button>
			<LibraryInlineName
				disabled={!writable}
				onChange={(name) => controller.change({ name })}
				value={asset.name}
			/>
		</div>
	);

	const documentViewer = viewerKind && mediaUrl;

	return (
		<div className='flex min-w-0 flex-1 flex-col'>
			{!documentViewer && (
				<Header
					actions={actions}
					className='gap-x-1.5 px-2 py-1.5 sm:px-3 sm:py-2 md:px-3'
					item={{ href: "/dashboard/library", labelTx: "library" }}
					leading={leading}
				/>
			)}
			<div className='mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-y-auto md:mx-3 md:mb-3'>
				{controller.status === "saveFailed" && (
					<p className='px-6 py-2 text-sm text-destructive' role='alert'>
						{t("saveFailed")}
					</p>
				)}
				{documentViewer && (
					<LibraryDocumentViewer
						actions={actions}
						kind={viewerKind}
						leading={leading}
						name={asset.name}
						src={mediaUrl}
					/>
				)}
				{!viewerKind && asset.content === null && (
					<>
						<div className='flex flex-1 items-center justify-center p-4 md:p-8'>
							<LibraryAssetPreview asset={asset} fileUrl={mediaUrl} />
						</div>
						<LibraryVersionStrip currentId={asset.id} versions={asset.versions} />
					</>
				)}
				{asset.content !== null && (
					<LibraryDocumentEditor
						content={asset.content}
						disabled={!writable}
						onChange={(content) => controller.change({ content })}
					/>
				)}
			</div>
			<Dialog onOpenChange={setConfirmDelete} open={confirmDelete}>
				<DialogContent closeLabel={tCommon("close")}>
					<DialogHeader>
						<DialogTitle>{t("deleteTitle")}</DialogTitle>
						<DialogDescription>{t("deleteDescription")}</DialogDescription>
					</DialogHeader>
					<Button loading={remove.isPending} onClick={() => remove.mutate()} variant='destructive'>
						{t("delete")}
					</Button>
				</DialogContent>
			</Dialog>
		</div>
	);
};

export const LibraryAssetPage = ({ assetId }: { assetId: string }) => {
	const t = useTranslations("library");
	const locale = useLocale();
	const queryClient = useQueryClient();
	const [version, setVersion] = useState(0);

	const query = useQuery({
		...apiClient.library.get.queryOptions({ input: { assetId } }),
		placeholderData: keepPreviousData,
		refetchInterval: (current) =>
			current.state.data?.status === "pending" ||
			current.state.data?.versions.some(({ generating }) => generating)
				? 2500
				: false,
	});

	useFollowNewVersion({ assetId, versions: query.data?.versions });

	const reload = async () => {
		await query.refetch();
		setVersion((current) => current + 1);
		queryClient.invalidateQueries({ queryKey: apiClient.library.list.key() });
	};

	if (query.isPending) {
		return (
			<>
				<Header item={{ labelTx: "library" }} />
				<div aria-label={t("loading")} className='mx-auto w-full max-w-3xl space-y-6 p-6' role='status'>
					<Skeleton className='h-10 w-2/3' />
					<Skeleton className='aspect-video w-full' />
				</div>
			</>
		);
	}

	if (!query.data) {
		return (
			<>
				<Header item={{ href: "/dashboard/library", labelTx: "library" }} />
				<div className='grid justify-items-start gap-3 p-6' role='alert'>
					{t("notFound")}
					<Button onClick={() => query.refetch()} variant='outline'>
						{t("retry")}
					</Button>
				</div>
			</>
		);
	}

	return (
		<SidebarProvider
			className='min-h-0'
			defaultOpen
			dir={locale === "ar" ? "rtl" : "ltr"}
			purpose='details'
			style={detailsSidebarStyle}
		>
			<LibraryAssetView
				asset={query.data}
				key={`${query.data.id}:${version}`}
				onConflict={() => {
					toast.error(t("conflict"));
					reload();
				}}
			/>
			<LibraryAgentSidebar assetId={assetId} onChange={() => reload()} onRefresh={() => query.refetch()} />
		</SidebarProvider>
	);
};
