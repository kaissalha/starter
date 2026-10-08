"use client";

import type { ReactNode } from "react";

import { Copy01Icon, Globe02Icon, Rocket01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Button } from "@starter/ui/components/button";
import {
	Popover,
	PopoverDescription,
	PopoverPopup,
	PopoverTitle,
	PopoverTrigger,
} from "@starter/ui/components/popover";
import { useCopyToClipboard } from "@starter/ui/hooks/use-copy-to-clipboard";
import { cn } from "@starter/ui/lib/utils";

import { EditorShareQr } from "./editor-share-qr";

type EditorPublication = {
	hasUnpublishedChanges: boolean;
	publishedAt: string | null;
};

export const EditorPublishPopover = ({
	children,
	disabled,
	kind,
	onPublish,
	publication,
	publicUrl,
	publishing,
}: {
	children?: ReactNode;
	disabled: boolean;
	kind: "links" | "website";
	onPublish: () => void;
	publication?: EditorPublication;
	publicUrl?: string;
	publishing: boolean;
}) => {
	const { can } = useOrganizationPermissions();
	const tCommon = useTranslations("common");
	const tLinks = useTranslations("links");
	const tWebsite = useTranslations("website");
	const t = kind === "links" ? tLinks : tWebsite;
	const { copyToClipboard, isCopied } = useCopyToClipboard();
	const published = Boolean(publication?.publishedAt);
	const hasChanges = Boolean(publication?.hasUnpublishedChanges);
	const upToDate = published && !hasChanges;
	const tShell = useTranslations("editorShell.publish");
	const publishLabel = t(published ? "publish.changes" : "publish.action");

	const description = (() => {
		if (!published) {
			return t("publish.description");
		}

		return t(hasChanges ? "publish.unpublishedDescription" : "publish.upToDateDescription");
	})();

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						aria-label={t("publish.open")}
						disabled={disabled || publishing || !publication}
						loading={publishing}
						size='default'
						type='button'
					/>
				}
			>
				{upToDate ? (
					<span aria-hidden='true' className='size-2 rounded-full bg-success' />
				) : (
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Rocket01Icon} strokeWidth={1.75} />
				)}
				<span className='sr-only md:not-sr-only'>{upToDate ? tShell("live") : t("publish.mobile")}</span>
			</PopoverTrigger>
			<PopoverPopup
				align='end'
				aria-live='polite'
				className='w-[min(24rem,calc(100vw-1rem))]'
				padding='none'
				side='bottom'
				sideOffset={8}
			>
				<div className='p-5'>
					<PopoverTitle>{t("publish.title")}</PopoverTitle>
					<PopoverDescription className='mt-1'>{description}</PopoverDescription>

					{published && (
						<div className='mt-4 flex items-center gap-2 text-sm font-medium'>
							<span
								aria-hidden='true'
								className={cn("size-2 rounded-full", hasChanges ? "bg-warning" : "bg-success")}
							/>
							<span>{hasChanges ? tShell("changes") : tShell("live")}</span>
						</div>
					)}

					{publicUrl && (
						<div className='mt-5'>
							<p className='mb-2 text-sm font-medium'>{t("publish.websiteUrl")}</p>
							<div className='flex h-11 items-center gap-2 rounded-lg border border-border bg-muted/32 px-3'>
								<HugeiconsIcon
									aria-hidden='true'
									className='size-4 shrink-0 text-muted-foreground scale-110'
									icon={Globe02Icon}
									strokeWidth={1.75}
								/>
								{published ? (
									<a
										className='min-w-0 flex-1 truncate text-sm hover:underline'
										dir='ltr'
										href={publicUrl}
										rel='noreferrer'
										target='_blank'
										title={publicUrl}
									>
										{publicUrl}
									</a>
								) : (
									<span className='min-w-0 flex-1 truncate text-sm' dir='ltr' title={publicUrl}>
										{publicUrl}
									</span>
								)}
								<Button
									aria-label={isCopied ? tCommon("copiedToClipboard") : tCommon("copyToClipboard")}
									className='-me-1'
									onClick={() => copyToClipboard(publicUrl)}
									size='icon-sm'
									type='button'
									variant='ghost'
								>
									{isCopied ? (
										<HugeiconsIcon
											aria-hidden='true'
											className='scale-110'
											icon={Tick02Icon}
											strokeWidth={1.75}
										/>
									) : (
										<HugeiconsIcon
											aria-hidden='true'
											className='scale-110'
											icon={Copy01Icon}
											strokeWidth={1.75}
										/>
									)}
								</Button>
							</div>
						</div>
					)}

					{published && publicUrl && <EditorShareQr url={publicUrl} />}

					{children && <div className='mt-3'>{children}</div>}

					<div className='mt-4 flex gap-3 rounded-lg bg-muted/48 p-3'>
						<div className='flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground smooth-shadow-ring-xs'>
							<HugeiconsIcon
								aria-hidden='true'
								className='size-4 scale-110'
								icon={Globe02Icon}
								strokeWidth={1.75}
							/>
						</div>
						<div className='min-w-0'>
							<p className='text-sm font-medium'>{t("publish.publicTitle")}</p>
							<p className='mt-0.5 text-sm leading-relaxed text-muted-foreground'>
								{t("publish.publicDescription")}
							</p>
						</div>
					</div>
				</div>

				<div className='sticky bottom-0 border-t border-border bg-popover p-3'>
					<Button
						className='w-full'
						disabled={!can("workspace.write") || disabled || !hasChanges}
						loading={publishing}
						onClick={onPublish}
						type='button'
					>
						{upToDate ? tShell("upToDate") : publishLabel}
					</Button>
				</div>
			</PopoverPopup>
		</Popover>
	);
};
