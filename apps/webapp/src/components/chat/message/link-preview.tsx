"use client";

import { useState, type SyntheticEvent } from "react";

import Image from "next/image";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api-client";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@starter/ui/components/preview-card";

import { getSiteInitial } from "./utils/site-initial";

type LinkPreviewProps = {
	children: React.ReactNode;
	className?: string;
	onClick?: React.MouseEventHandler<HTMLAnchorElement>;
	url: string;
};

export const LinkPreview = ({ children, className, onClick, url }: LinkPreviewProps) => {
	const t = useTranslations("components.chat.message.linkPreview");
	const [shouldLoadMetadata, setShouldLoadMetadata] = useState(false);

	const { data: metadata, isLoading } = useQuery(
		apiClient.linkPreviews.get.queryOptions({
			enabled: shouldLoadMetadata,
			input: { url },
			retry: false,
			staleTime: 20 * 60 * 1000,
		})
	);

	const previewContent = (() => {
		if (!shouldLoadMetadata || isLoading) {
			return (
				<div className='min-w-0 flex-1 space-y-2'>
					<div className='h-3 w-24 animate-pulse rounded bg-muted' />
					<div className='h-4 w-full animate-pulse rounded bg-muted' />
					<div className='h-4 w-3/4 animate-pulse rounded bg-muted' />
				</div>
			);
		}

		if (metadata) {
			return (
				<a className='min-w-0 flex-1' href={url} rel='noopener noreferrer' target='_blank'>
					<div className='mb-2 flex items-center gap-1'>
						{metadata.favicon ? (
							<Image
								alt={t("faviconAlt", { siteName: metadata.siteName })}
								className='size-4 shrink-0 rounded-md'
								height={16}
								onError={(event: SyntheticEvent<HTMLImageElement>) => {
									event.currentTarget.style.display = "none";
								}}
								src={metadata.favicon}
								unoptimized
								width={16}
							/>
						) : (
							<div className='flex size-4 shrink-0 items-center justify-center rounded-md bg-muted'>
								<span className='text-xs font-bold text-foreground'>
									{getSiteInitial(metadata.siteName) ?? "·"}
								</span>
							</div>
						)}
						<span className='min-w-0 truncate text-xs font-medium text-foreground'>
							{metadata.siteName}
						</span>
					</div>

					<p className='line-clamp-2 text-sm font-medium text-foreground'>{metadata.title}</p>

					{metadata.description ? (
						<p className='mt-1 line-clamp-3 text-sm text-muted-foreground'>{metadata.description}</p>
					) : null}
				</a>
			);
		}

		return null;
	})();

	return (
		<PreviewCard>
			<PreviewCardTrigger
				className={className}
				closeDelay={300}
				delay={150}
				href={url}
				onClick={onClick}
				onFocus={() => setShouldLoadMetadata(true)}
				onMouseEnter={() => setShouldLoadMetadata(true)}
				rel='noopener noreferrer'
				target='_blank'
				variant='link'
			>
				{children}
			</PreviewCardTrigger>

			<PreviewCardPopup
				align='start'
				aria-live='polite'
				className='min-w-80 max-w-96'
				collisionPadding={16}
				side='top'
				sideOffset={8}
				suppressHydrationWarning={true}
			>
				{previewContent}
			</PreviewCardPopup>
		</PreviewCard>
	);
};
