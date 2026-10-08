"use client";

import { useEffect, useRef, useState } from "react";

import Image from "next/image";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { apiClient, client } from "@/lib/api-client";
import { Button } from "@starter/ui/components/button";
import { Card } from "@starter/ui/components/card";
import { Input } from "@starter/ui/components/input";

import type { UploadedMedia } from "./use-media-upload";

export const StockPhotoPicker = ({
	disabled,
	onSelect,
}: {
	disabled?: boolean;
	onSelect: (media: UploadedMedia) => Promise<void>;
}) => {
	const t = useTranslations("media");
	const [input, setInput] = useState("");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const request = useRef<AbortController | null>(null);
	useEffect(() => () => request.current?.abort(), []);
	const [failed, setFailed] = useState(false);

	const results = useInfiniteQuery(
		apiClient.media.searchStock.infiniteOptions<number>({
			enabled: query.length > 0,
			getNextPageParam: (page) => page.nextPage ?? undefined,
			initialPageParam: 1,
			input: (page) => ({ page, query }),
			retry: false,
			staleTime: 60_000,
		})
	);

	const items = [
		...new Map((results.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [item.id, item])).values(),
	];

	return (
		<>
			<form
				className='flex gap-2'
				onSubmit={(event) => {
					event.preventDefault();
					setQuery(input.trim());
					setSelected(null);
					setFailed(false);
				}}
			>
				<Input
					aria-label={t("stockSearch")}
					maxLength={100}
					onChange={(event) => setInput(event.target.value)}
					placeholder={t("stockSearch")}
					value={input}
				/>
				<Button disabled={!input.trim() || saving} type='submit' variant='outline'>
					{t("searchAction")}
				</Button>
			</form>
			<div className='min-h-0 flex-1 space-y-3 overflow-y-auto'>
				{!query && <p className='p-4 text-sm text-muted-foreground'>{t("stockPrompt")}</p>}
				{query && results.isPending && (
					<p className='p-4 text-sm text-muted-foreground' role='status'>
						{t("loading")}
					</p>
				)}
				{results.data?.pages.some((page) => page.partial) && (
					<p className='text-xs text-muted-foreground' role='status'>
						{t("stockPartial")}
					</p>
				)}
				{results.isError && (
					<div className='space-y-2 text-sm' role='alert'>
						<p>{t("stockFailed")}</p>
						<Button onClick={() => results.refetch()} variant='outline'>
							{t("retry")}
						</Button>
					</div>
				)}
				{query && !results.isPending && !results.isError && !items.length && (
					<p className='p-4 text-sm text-muted-foreground'>{t("stockEmpty")}</p>
				)}
				<div className='grid grid-cols-2 gap-3'>
					{items.map((item) => (
						<Button
							aria-label={item.alt || t("stockPhoto")}
							aria-pressed={selected === item.id}
							className='group relative block w-full min-w-0'
							disabled={disabled || saving}
							key={item.id}
							onClick={() => {
								setSelected(item.id);
								setFailed(false);
							}}
							unstyled
						>
							<Card variant='selectable'>
								<Image
									alt=''
									className='aspect-[4/3] w-full rounded object-cover'
									height={240}
									loading='lazy'
									src={item.thumbnailUrl}
									unoptimized
									width={320}
								/>
							</Card>
						</Button>
					))}
				</div>
				{results.hasNextPage && (
					<Button
						className='w-full'
						disabled={results.isFetchingNextPage}
						onClick={() => results.fetchNextPage()}
						variant='ghost'
					>
						{t("more")}
					</Button>
				)}
			</div>
			{failed && (
				<p className='text-sm text-destructive' role='alert'>
					{t("stockSelectFailed")}
				</p>
			)}
			<Button
				className='w-full'
				disabled={!selected || disabled || saving}
				loading={saving}
				onClick={async () => {
					if (!selected) {
						return;
					}

					const controller = new AbortController();
					request.current = controller;
					setSaving(true);
					setFailed(false);

					try {
						const media = await client.media.selectStock({ id: selected }, { signal: controller.signal });

						if (!controller.signal.aborted) {
							await onSelect(media);
						}
					} catch {
						if (!controller.signal.aborted) {
							setFailed(true);
						}
					} finally {
						setSaving(false);
					}
				}}
				size='lg'
			>
				{t("use")}
			</Button>
		</>
	);
};
