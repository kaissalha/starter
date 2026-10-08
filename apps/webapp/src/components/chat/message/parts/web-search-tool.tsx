"use client";

import Image from "next/image";

import { ArrowUpRight01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";

import { Skeleton } from "@starter/ui/components/skeleton";
import { TextShimmer } from "@starter/ui/components/text-shimmer";
import { getHostnameFromUrl } from "@starter/utils";

import { ChatStepItem } from "../chat-step-item";
import type { ToolState } from "./tool-part-types";
import { formatPublishedDate } from "./utils/published-date";

type WebSearchResult = {
	description?: string;
	favicon?: string | null;
	publishedDate?: string | null;
	text?: string;
	title?: string;
	url: string;
};

type WebSearchOutput = {
	error?: string;
	message?: string;
	results?: Array<WebSearchResult>;
};

const webSearchOutputSchema: z.ZodType<WebSearchOutput> = z.compile(
	z.object({
		error: z.string().optional(),
		message: z.string().optional(),
		results: z
			.array(
				z.object({
					description: z.string().optional(),
					favicon: z.string().nullable().optional(),
					publishedDate: z.string().nullable().optional(),
					text: z.string().optional(),
					title: z.string().optional(),
					url: z.string(),
				})
			)
			.optional(),
	})
);

const webSearchInputSchema = z.compile(z.object({ query: z.string().optional() }));

const SKELETON_KEYS = ["row-1", "row-2", "row-3"];

const searchIcon = (
	<HugeiconsIcon aria-hidden='true' className='size-3.5 scale-110' icon={Search01Icon} strokeWidth={1.75} />
);

const SearchSource = ({ result }: { result: WebSearchResult }) => {
	const locale = useLocale();
	const hostname = getHostnameFromUrl({ url: result.url });
	const snippet = result.description || result.text;
	const faviconUrl = result.favicon || `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
	const publishedLabel = formatPublishedDate({ locale, value: result.publishedDate });

	return (
		<a
			className='group flex gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50'
			href={result.url}
			rel='noopener noreferrer'
			target='_blank'
		>
			<Image
				alt=''
				className='mt-0.5 size-4 shrink-0 object-contain'
				height={16}
				referrerPolicy='no-referrer'
				src={faviconUrl}
				unoptimized
				width={16}
			/>
			<div className='min-w-0 flex-1'>
				<div className='flex items-center gap-1.5'>
					<span className='truncate text-sm font-medium text-foreground'>{result.title || hostname}</span>
					<HugeiconsIcon
						aria-hidden='true'
						className='size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 scale-110'
						icon={ArrowUpRight01Icon}
						strokeWidth={1.75}
					/>
				</div>
				<div className='mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground'>
					<span className='truncate'>{hostname}</span>
					{publishedLabel && (
						<>
							<span aria-hidden className='size-0.5 shrink-0 rounded-full bg-muted-foreground/40' />
							<span className='shrink-0'>{publishedLabel}</span>
						</>
					)}
				</div>
				{snippet && <p className='mt-1 line-clamp-2 text-xs text-muted-foreground/80'>{snippet}</p>}
			</div>
		</a>
	);
};

export type WebSearchToolProps = {
	errorText?: string;
	input?: unknown;
	isLast?: boolean;
	output?: unknown;
	state: ToolState;
};

export const WebSearchTool = ({ input, isLast = false, output, state }: WebSearchToolProps) => {
	const t = useTranslations("components.chat.message.tool");
	const parsedInput = webSearchInputSchema.safeParse(input);
	const query = parsedInput.success ? parsedInput.data.query : undefined;

	if (state === "output-error" || state === "output-denied") {
		return <ChatStepItem icon={searchIcon} isLast={isLast} label={t("webSearch.error")} status='error' />;
	}

	if (
		state === "input-streaming" ||
		state === "input-available" ||
		state === "approval-requested" ||
		state === "approval-responded"
	) {
		return (
			<ChatStepItem
				activity='searching'
				defaultOpen
				icon={searchIcon}
				isLast={isLast}
				label={<TextShimmer variant='label'>{t("webSearch.searching")}</TextShimmer>}
				status='running'
			>
				<div className='space-y-1.5 pt-1'>
					{query && (
						<span className='inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-xs text-foreground'>
							<HugeiconsIcon
								aria-hidden='true'
								className='size-3 shrink-0 scale-110'
								icon={Search01Icon}
								strokeWidth={1.75}
							/>
							<span className='truncate'>{query}</span>
						</span>
					)}
					{SKELETON_KEYS.map((rowKey) => (
						<div className='flex items-start gap-2.5 px-2 py-0.5' key={rowKey}>
							<Skeleton className='mt-0.5 size-4 shrink-0' />
							<div className='flex-1 space-y-1.5'>
								<Skeleton className='h-3 w-3/4' />
								<Skeleton className='h-2.5 w-1/2' />
							</div>
						</div>
					))}
				</div>
			</ChatStepItem>
		);
	}

	const parsedOutput = webSearchOutputSchema.safeParse(output);
	const data = parsedOutput.success ? parsedOutput.data : undefined;

	if (data?.error) {
		return <ChatStepItem icon={searchIcon} isLast={isLast} label={t("webSearch.error")} status='error' />;
	}

	const seenUrls = new Set<string>();

	const results = (data?.results ?? []).filter((result) => {
		if (!result.url || seenUrls.has(result.url)) {
			return false;
		}

		seenUrls.add(result.url);

		return true;
	});

	if (results.length === 0) {
		return <ChatStepItem icon={searchIcon} isLast={isLast} label={t("webSearch.noResults")} status='done' />;
	}

	return (
		<ChatStepItem
			icon={searchIcon}
			isLast={isLast}
			label={t("webSearch.sources", { count: results.length })}
			status='done'
		>
			<div className='pt-1'>
				{results.map((result) => (
					<SearchSource key={result.url} result={result} />
				))}
			</div>
		</ChatStepItem>
	);
};

WebSearchTool.displayName = "WebSearchTool";
