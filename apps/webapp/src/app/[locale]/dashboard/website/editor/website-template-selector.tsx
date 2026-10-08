"use client";

import { memo, startTransition, useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { EditorPanelFooter } from "@/app/[locale]/dashboard/components/editor/editor-panel-footer";
import { EditorPanelHeader } from "@/app/[locale]/dashboard/components/editor/editor-panel-header";
import { WebsiteScaledPreview } from "@/components/website-scaled-preview";
import { apiClient } from "@/lib/api-client";
import { SiteRenderer } from "@starter/infinite-website";
import type { WebsiteSnapshotV1 } from "@starter/infinite-website/generation";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { Radio, RadioGroup } from "@starter/ui/components/radio-group";
import { toast } from "@starter/ui/components/toaster";

import { useWebsiteTemplatePreview } from "./use-website-template-preview";

const INITIAL_TEMPLATE_PREVIEWS = 2;

const scheduleTemplatePreview = (callback: () => void) => {
	if (window.requestIdleCallback) {
		const handle = window.requestIdleCallback(callback, { timeout: 500 });

		return () => window.cancelIdleCallback(handle);
	}

	const handle = globalThis.setTimeout(callback, 100);

	return () => globalThis.clearTimeout(handle);
};

const WebsiteTemplateOption = memo(
	({
		generating,
		id,
		locale,
		name,
		recommendedLabel,
		renderPreview,
		thumbnail,
	}: {
		generating: boolean;
		id: string;
		locale: WebsiteSnapshotV1["document"]["defaultLocale"];
		name: string;
		recommendedLabel?: string;
		renderPreview: boolean;
		thumbnail: WebsiteSnapshotV1;
	}) => (
		<label
			aria-busy={generating}
			className='group relative cursor-pointer overflow-hidden rounded-xl bg-background outline outline-border transition-[outline-color,opacity] focus-within:outline-2 focus-within:outline-ring has-data-checked:outline-2 has-data-checked:outline-foreground has-data-unchecked:[@media(hover:hover)]:hover:opacity-80 has-disabled:pointer-events-none has-disabled:opacity-50 motion-reduce:transition-none [contain-intrinsic-size:0_16rem] [content-visibility:auto]'
			data-template-id={id}
		>
			<Radio value={id} variant='card' />
			<span className='sr-only'>{name}</span>
			{recommendedLabel && (
				<Badge className='pointer-events-none absolute start-2 top-2 z-10' variant='dark'>
					{recommendedLabel}
				</Badge>
			)}
			<WebsiteScaledPreview className='aspect-video bg-muted/52' scale='quarter'>
				{renderPreview ? (
					<SiteRenderer
						assets={thumbnail.assets}
						brand={thumbnail.brand}
						document={thumbnail.document}
						locale={locale}
					/>
				) : (
					<span aria-hidden='true' className='shimmer shimmer-bg block size-full' />
				)}
			</WebsiteScaledPreview>
		</label>
	)
);

WebsiteTemplateOption.displayName = "WebsiteTemplateOption";

const WebsiteTemplateSelectorLoading = ({ label }: { label: string }) => (
	<div className='shimmer-container grid gap-3' role='status'>
		<span className='sr-only'>{label}</span>
		{[0, 1, 2].map((item) => (
			<span className='shimmer shimmer-bg block aspect-video rounded-xl bg-muted/52' key={item} />
		))}
	</div>
);

export const WebsiteTemplateSelector = ({
	locale,
	onApply,
	onCancel,
	onPreview,
	snapshot,
	websiteId,
}: {
	locale: WebsiteSnapshotV1["document"]["defaultLocale"];
	onApply: (templateId: string) => Promise<void>;
	onCancel: () => void;
	onPreview: (snapshot: WebsiteSnapshotV1) => void;
	snapshot: WebsiteSnapshotV1;
	websiteId: string;
}) => {
	const t = useTranslations("website.templates");
	const [baselineSnapshot] = useState(snapshot);
	const [applying, setApplying] = useState(false);

	const { abortPreview, generatingTemplateId, previewTemplate, selectedTemplateId } = useWebsiteTemplatePreview({
		baselineSnapshot,
		locale,
		onPreview,
		websiteId,
	});

	const [visiblePreviews, setVisiblePreviews] = useState<ReadonlySet<string>>(new Set());
	const templateOptions = useRef<HTMLDivElement>(null);
	const templatesQuery = useQuery(apiClient.websites.templates.queryOptions({ staleTime: Number.POSITIVE_INFINITY }));

	const recommendationsQuery = useQuery(
		apiClient.websites.templateRecommendations.queryOptions({ retry: false, staleTime: Number.POSITIVE_INFINITY })
	);

	const recommendedTemplateIds = recommendationsQuery.data?.templateIds;

	const options = useMemo(() => {
		const listed = templatesQuery.data ?? [
			{
				description: "",
				id: baselineSnapshot.templateId,
				name: baselineSnapshot.templateId
					.split("-")
					.map((part) => `${part[0]?.toLocaleUpperCase() ?? ""}${part.slice(1)}`)
					.join(" "),
				preview: baselineSnapshot,
				tags: [],
			},
		];

		const rank = new Map((recommendedTemplateIds ?? []).map((id, index) => [id, index]));

		return listed.toSorted(
			(left, right) =>
				(rank.get(left.id) ?? Number.POSITIVE_INFINITY) - (rank.get(right.id) ?? Number.POSITIVE_INFINITY)
		);
	}, [baselineSnapshot, recommendedTemplateIds, templatesQuery.data]);

	useEffect(() => {
		const root = templateOptions.current;

		if (!root || options.length === 0) {
			return;
		}

		const candidates = [...root.querySelectorAll<HTMLElement>("[data-template-id]")].slice(
			INITIAL_TEMPLATE_PREVIEWS
		);

		if (!window.IntersectionObserver) {
			return scheduleTemplatePreview(() => setVisiblePreviews(new Set(options.map(({ id }) => id))));
		}

		const cancellations = new Set<() => void>();

		const observer = new window.IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) {
						continue;
					}

					const templateId = entry.target.dataset.templateId;

					if (!templateId) {
						continue;
					}

					observer.unobserve(entry.target);
					cancellations.add(
						scheduleTemplatePreview(() =>
							startTransition(() => setVisiblePreviews((current) => new Set([...current, templateId])))
						)
					);
				}
			},
			{ root, rootMargin: "240px 0px" }
		);

		candidates.forEach((candidate) => observer.observe(candidate));

		return () => {
			observer.disconnect();
			cancellations.forEach((cancel) => cancel());
		};
	}, [options]);

	const cancelPreview = () => {
		abortPreview();
		onCancel();
	};

	return (
		<div className='flex h-full min-h-0 flex-col'>
			<EditorPanelHeader backLabel={t("back")} disabled={applying} onBack={cancelPreview} title={t("title")} />
			<div
				aria-busy={templatesQuery.isLoading}
				className='min-h-0 flex-1 overflow-y-auto p-4'
				ref={templateOptions}
			>
				{templatesQuery.isLoading && <WebsiteTemplateSelectorLoading label={t("loading")} />}
				<RadioGroup
					aria-label={t("title")}
					className='grid'
					disabled={applying}
					onValueChange={previewTemplate}
					value={selectedTemplateId}
				>
					{options.map((option, index) => (
						<WebsiteTemplateOption
							generating={generatingTemplateId === option.id}
							id={option.id}
							key={option.id}
							locale={locale}
							name={option.name}
							recommendedLabel={
								recommendedTemplateIds?.includes(option.id) ? t("recommended") : undefined
							}
							renderPreview={index < INITIAL_TEMPLATE_PREVIEWS || visiblePreviews.has(option.id)}
							thumbnail={option.preview}
						/>
					))}
				</RadioGroup>
			</div>
			<EditorPanelFooter cancelDisabled={applying} cancelLabel={t("cancel")} onCancel={cancelPreview}>
				<Button
					disabled={selectedTemplateId === baselineSnapshot.templateId}
					loading={applying}
					onClick={async () => {
						abortPreview();
						setApplying(true);

						try {
							await onApply(selectedTemplateId);
						} catch {
							toast.error(t("applyFailed"));
						} finally {
							setApplying(false);
						}
					}}
					type='button'
				>
					{t("done")}
				</Button>
			</EditorPanelFooter>
		</div>
	);
};

export const WebsiteTemplatePreview = ({
	locale,
	snapshot,
}: {
	locale: WebsiteSnapshotV1["document"]["defaultLocale"];
	snapshot: WebsiteSnapshotV1;
}) => (
	<WebsiteScaledPreview className='size-full' scale='quarter'>
		<SiteRenderer assets={snapshot.assets} brand={snapshot.brand} document={snapshot.document} locale={locale} />
	</WebsiteScaledPreview>
);
