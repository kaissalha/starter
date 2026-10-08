"use client";

import { ArrowUpRight01Icon, Link01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "@starter/ui/lib/utils";
import { getHostnameFromUrl } from "@starter/utils";

export type SourcePartProps = {
	title?: string;
	url: string;
};

export const SourcePart = ({ title, url }: SourcePartProps) => {
	const displayTitle = title || getHostnameFromUrl({ url });

	return (
		<a
			className={cn(
				"group inline-flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm transition-colors",
				"hover:border-border hover:bg-muted/50",
				"outline-none"
			)}
			href={url}
			rel='noopener noreferrer'
			target='_blank'
		>
			<HugeiconsIcon
				aria-hidden='true'
				className='size-3.5 text-muted-foreground scale-110'
				icon={Link01Icon}
				strokeWidth={1.75}
			/>
			<span className='max-w-50 truncate text-foreground'>{displayTitle}</span>
			<HugeiconsIcon
				aria-hidden='true'
				className='size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 scale-110'
				icon={ArrowUpRight01Icon}
				strokeWidth={1.75}
			/>
		</a>
	);
};

SourcePart.displayName = "SourcePart";

export type SourcesContainerProps = {
	sources: Array<{ title?: string; url: string }>;
};

export const SourcesContainer = ({ sources }: SourcesContainerProps) => {
	if (!sources || sources.length === 0) {
		return null;
	}

	return (
		<div className='flex flex-wrap gap-2'>
			{sources.map((source) => (
				<SourcePart key={source.url} title={source.title} url={source.url} />
			))}
		</div>
	);
};

SourcesContainer.displayName = "SourcesContainer";
