"use client";

import Image from "next/image";

import { File01Icon, Image01Icon, Attachment01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { getDisplayFileExtension } from "@starter/documents";
import { cn } from "@starter/ui/lib/utils";

export type FilePartProps = {
	filename?: string;
	mediaType: string;
	url: string;
};

export const FilePart = ({ filename, mediaType, url }: FilePartProps) => {
	if (mediaType.startsWith("image/") && url) {
		return <ImageFile filename={filename} mediaType={mediaType} url={url} />;
	}

	return <GenericFile filename={filename} mediaType={mediaType} />;
};

FilePart.displayName = "FilePart";

const ImageFile = ({ filename, url }: FilePartProps) => {
	return (
		<div className='overflow-hidden rounded-lg border border-border/50'>
			<Image
				alt={filename || "Attached image"}
				className='h-auto max-h-100 max-w-full object-contain'
				height={1200}
				src={url}
				unoptimized
				width={1600}
			/>
			{filename && (
				<div className='flex items-center gap-1.5 border-t border-border/50 bg-muted/30 px-2.5 py-1.5'>
					<HugeiconsIcon
						aria-hidden='true'
						className='size-3 text-muted-foreground/60 scale-110'
						icon={Image01Icon}
						strokeWidth={1.75}
					/>
					<span className='truncate text-xs text-muted-foreground'>{filename}</span>
				</div>
			)}
		</div>
	);
};

const GenericFile = ({ filename, mediaType }: Omit<FilePartProps, "url">) => {
	const t = useTranslations("components.chat.message.file");
	const extension = getDisplayFileExtension({ filename, mediaType }) ?? t("file");

	return (
		<div
			className={cn(
				"group flex max-w-65 items-center gap-2 rounded-md border border-border bg-muted/40 ps-2 pe-2.5 py-1.5 text-xs text-muted-foreground"
			)}
		>
			<span className='flex size-6 shrink-0 items-center justify-center rounded-sm bg-background text-muted-foreground/70'>
				<HugeiconsIcon aria-hidden='true' className='size-3.5 scale-110' icon={File01Icon} strokeWidth={1.75} />
			</span>
			<span className='flex min-w-0 flex-col text-start'>
				<span className='truncate text-foreground'>{filename || t("attachment")}</span>
				<span className='inline-flex items-center gap-1 text-xs text-muted-foreground/70'>
					<HugeiconsIcon
						aria-hidden='true'
						className='size-2.5 scale-110'
						icon={Attachment01Icon}
						strokeWidth={1.75}
					/>
					{extension}
				</span>
			</span>
		</div>
	);
};
