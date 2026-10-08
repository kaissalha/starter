"use client";

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";

import { EditorBackButton } from "@/app/[locale]/dashboard/components/editor/editor-back-button";
import { WebsiteScaledPreview } from "@/components/website-scaled-preview";
import { apiClient } from "@/lib/api-client";
import { SiteRenderer, type SiteDocument } from "@starter/infinite-website";
import {
	websiteGenerationSectionCategories,
	type WebsiteGenerationSectionCategory,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Skeleton } from "@starter/ui/components/skeleton";

import { type SectionInsertionTarget, useWebsiteGenerationStore } from "../generation/website-generation-store";

type WebsiteSectionCandidate = {
	pattern: string;
};

type WebsiteSectionSelection = SectionInsertionTarget & { pattern: string; previewDocument?: SiteDocument };

const SECTION_PREVIEW_BATCH_SIZE = 4;

const SECTION_PREVIEW_CACHE_TIME = 30 * 60 * 1000;

const SEMANTIC_QUERY_WORDS = 3;

const isSemanticQuery = (query: string) => query.split(/\s+/u).filter(Boolean).length >= SEMANTIC_QUERY_WORDS;

const WebsiteSectionCandidateChunk = memo(
	({
		candidates,
		eager,
		onClose,
		onSelect,
		recommendedPattern,
		snapshot,
		target,
		websiteId,
	}: {
		candidates: ReadonlyArray<WebsiteSectionCandidate>;
		eager: boolean;
		onClose: () => void;
		onSelect: (input: WebsiteSectionSelection) => Promise<void>;
		recommendedPattern: string | null;
		snapshot: Pick<WebsiteSnapshotV1, "brand" | "assets">;
		target: SectionInsertionTarget;
		websiteId: string;
	}) => {
		const t = useTranslations("website.sectionCatalog");
		const tCommon = useTranslations("common");
		const chunkRef = useRef<HTMLDivElement>(null);
		const patterns = candidates.map(({ pattern }) => pattern);
		const [visible, setVisible] = useState(eager);

		useEffect(() => {
			if (visible || patterns.length === 0) {
				return;
			}

			const element = chunkRef.current;

			if (!element) {
				return;
			}

			const observer = new IntersectionObserver(
				([entry]) => {
					if (entry?.isIntersecting) {
						setVisible(true);
						observer.disconnect();
					}
				},
				{ rootMargin: "400px" }
			);

			observer.observe(element);

			return () => observer.disconnect();
		}, [patterns.length, visible]);

		const previewQuery = useQuery(
			apiClient.websites.sectionPreviews.queryOptions({
				enabled: visible && patterns.length > 0,
				gcTime: SECTION_PREVIEW_CACHE_TIME,
				input: { pageId: target.pageId, patterns, websiteId },
				staleTime: Number.POSITIVE_INFINITY,
			})
		);

		const previews = new Map(previewQuery.data?.map((preview) => [preview.pattern, preview]));

		return (
			<div className='space-y-4' ref={chunkRef}>
				{previewQuery.isError && (
					<div className='rounded-xl bg-muted/52 p-3 text-sm' role='alert'>
						<p className='text-muted-foreground'>{tCommon("messages.somethingWentWrong")}</p>
						<Button className='mt-2' onClick={() => previewQuery.refetch()} size='sm' variant='outline'>
							{tCommon("retry")}
						</Button>
					</div>
				)}
				{candidates.map((candidate) => {
					const preview = previews.get(candidate.pattern);
					const name = candidate.pattern.replaceAll("-", " ");

					return preview ? (
						<div
							className='relative w-full cursor-pointer overflow-hidden rounded-xl bg-muted/52 outline outline-border transition-[outline-color,opacity] focus-within:outline-2 focus-within:outline-ring [@media(hover:hover)]:hover:opacity-80 motion-reduce:transition-none [contain-intrinsic-size:0_22rem] [content-visibility:auto]'
							key={candidate.pattern}
						>
							<WebsiteScaledPreview className='w-full bg-muted/52' fitContent scale='quarter'>
								<SiteRenderer
									assets={preview.assets}
									brand={snapshot.brand}
									document={preview.document}
									preview
								/>
							</WebsiteScaledPreview>
							{candidate.pattern === recommendedPattern ? (
								<Badge className='absolute top-2 start-2 z-10' variant='dark'>
									{t("recommended")}
								</Badge>
							) : null}
							<Button
								aria-label={`${t("select")} ${name}`}
								className='absolute inset-0 h-full w-full sm:h-full'
								onClick={async () => {
									onClose();
									await onSelect({
										...target,
										pattern: candidate.pattern,
										previewDocument: preview.document,
									});
								}}
								type='button'
								unstyled
							/>
						</div>
					) : (
						<div
							aria-hidden='true'
							className='shimmer shimmer-bg aspect-video rounded-xl bg-muted/52'
							key={candidate.pattern}
						/>
					);
				})}
			</div>
		);
	}
);

WebsiteSectionCandidateChunk.displayName = "WebsiteSectionCandidateChunk";

const WebsiteSectionCatalogContent = ({
	onClose,
	onSelect,
	snapshot,
	target,
	websiteId,
}: {
	onClose: () => void;
	onSelect: (input: WebsiteSectionSelection) => Promise<void>;
	snapshot: WebsiteSnapshotV1;
	target: SectionInsertionTarget;
	websiteId: string;
}) => {
	const t = useTranslations("website.sectionCatalog");
	const tCommon = useTranslations("common");
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState<WebsiteGenerationSectionCategory | null>(null);
	const deferredQuery = useDeferredValue(query.trim());
	const semanticByLength = isSemanticQuery(deferredQuery);
	const baseInput = { category: category ?? undefined, index: target.index, pageId: target.pageId, websiteId };

	const literalQuery = useQuery(
		apiClient.websites.sectionCatalog.queryOptions({
			enabled: !semanticByLength,
			input: { ...baseInput, query: deferredQuery || undefined },
			staleTime: 60_000,
		})
	);

	const semantic = Boolean(deferredQuery) && (semanticByLength || literalQuery.data?.patterns.length === 0);

	const semanticQuery = useQuery(
		apiClient.websites.sectionCatalog.queryOptions({
			enabled: semantic,
			input: { ...baseInput, recommend: deferredQuery },
			staleTime: 60_000,
		})
	);

	const catalogQuery = semantic ? semanticQuery : literalQuery;
	const recommendedPattern = catalogQuery.data?.recommendedPattern ?? null;

	const candidateChunks = useMemo(() => {
		const patterns = catalogQuery.data?.patterns ?? [];

		const candidates = patterns.toSorted(
			(left, right) => Number(right.pattern === recommendedPattern) - Number(left.pattern === recommendedPattern)
		);

		return Array.from({ length: Math.ceil(candidates.length / SECTION_PREVIEW_BATCH_SIZE) }, (_, index) =>
			candidates.slice(index * SECTION_PREVIEW_BATCH_SIZE, (index + 1) * SECTION_PREVIEW_BATCH_SIZE)
		);
	}, [catalogQuery.data, recommendedPattern]);

	return (
		<div className='flex h-full min-h-0 flex-col'>
			<div className='border-b border-sidebar-border px-4 py-3'>
				<div className='flex items-start gap-2'>
					<EditorBackButton aria-label={t("close")} className='-ms-2 shrink-0' onClick={onClose} />
					<div className='min-w-0'>
						<h2 className='font-medium'>{t("title")}</h2>
						<p className='mt-0.5 text-xs text-muted-foreground'>{t("description")}</p>
					</div>
				</div>
			</div>
			<div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
				<Input
					aria-label={t("search")}
					onChange={(event) => setQuery(event.currentTarget.value)}
					placeholder={t("search")}
					value={query}
				/>
				<div aria-label={t("filter")} className='flex flex-wrap gap-1.5' role='group'>
					<Button
						onClick={() => setCategory(null)}
						size='xs'
						type='button'
						variant={category === null ? "default" : "outline"}
					>
						{t("allCategories")}
					</Button>
					{websiteGenerationSectionCategories.map((candidate) => (
						<Button
							key={candidate}
							onClick={() => setCategory(candidate)}
							size='xs'
							type='button'
							variant={category === candidate ? "default" : "outline"}
						>
							{t(`categories.${candidate}`)}
						</Button>
					))}
				</div>
				{catalogQuery.isLoading && (
					<div aria-label={t("loading")} className='grid gap-4' role='status'>
						<Skeleton className='aspect-[5/2] w-full' corners='rounded' />
						<Skeleton className='aspect-[5/2] w-full' corners='rounded' />
						<Skeleton className='aspect-[5/2] w-full' corners='rounded' />
					</div>
				)}
				{catalogQuery.isError && (
					<div className='rounded-xl bg-muted/52 p-4 text-sm' role='alert'>
						<p className='text-muted-foreground'>{tCommon("messages.somethingWentWrong")}</p>
						<Button className='mt-3' onClick={() => catalogQuery.refetch()} size='sm' variant='outline'>
							{tCommon("retry")}
						</Button>
					</div>
				)}
				{candidateChunks.map((chunk, index) => (
					<WebsiteSectionCandidateChunk
						candidates={chunk}
						eager={index === 0}
						key={chunk.map(({ pattern }) => pattern).join(":")}
						onClose={onClose}
						onSelect={onSelect}
						recommendedPattern={recommendedPattern}
						snapshot={snapshot}
						target={target}
						websiteId={websiteId}
					/>
				))}
			</div>
		</div>
	);
};

export const WebsiteSectionCatalogPanel = ({
	onSelect,
	snapshot,
	websiteId,
}: {
	onSelect: (input: WebsiteSectionSelection) => Promise<void>;
	snapshot: WebsiteSnapshotV1;
	websiteId: string;
}) => {
	const { closeCatalog, target } = useWebsiteGenerationStore(
		useShallow((state) => ({ closeCatalog: state.closeCatalog, target: state.catalogTarget }))
	);

	return target ? (
		<WebsiteSectionCatalogContent
			onClose={closeCatalog}
			onSelect={onSelect}
			snapshot={snapshot}
			target={target}
			websiteId={websiteId}
		/>
	) : null;
};
