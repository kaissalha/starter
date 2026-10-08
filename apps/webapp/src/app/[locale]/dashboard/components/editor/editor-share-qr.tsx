"use client";

import Image from "next/image";

import { Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";

import { Button } from "@starter/ui/components/button";
import { Skeleton } from "@starter/ui/components/skeleton";

export const EditorShareQr = ({ url }: { url: string }) => {
	const t = useTranslations("editorShell.share");

	const qr = useQuery({
		queryFn: () => QRCode.toDataURL(url, { margin: 1, width: 768 }),
		queryKey: ["editor-share-qr", url],
		staleTime: Number.POSITIVE_INFINITY,
	});

	return (
		<div className='mt-4 flex items-center gap-4 rounded-lg bg-muted/48 p-3'>
			{qr.data ? (
				<Image
					alt={t("alt")}
					className='size-20 shrink-0 rounded-md bg-white p-1 smooth-shadow-ring-xs'
					height={80}
					src={qr.data}
					unoptimized
					width={80}
				/>
			) : (
				<Skeleton className='size-20 shrink-0' />
			)}
			<div className='grid min-w-0 gap-2'>
				<p className='text-sm font-medium'>{t("title")}</p>
				<Button
					className='justify-self-start'
					disabled={!qr.data}
					nativeButton={false}
					render={<a download='qr-code.png' href={qr.data} />}
					size='sm'
					variant='outline'
				>
					<HugeiconsIcon
						aria-hidden
						className='scale-110'
						data-icon='inline-start'
						icon={Download04Icon}
						strokeWidth={1.75}
					/>
					{t("download")}
				</Button>
			</div>
		</div>
	);
};
