"use client";

import { memo, startTransition, useEffect, useMemo, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import { EditorPanelFooter } from "@/app/[locale]/dashboard/components/editor/editor-panel-footer";
import { EditorPanelHeader } from "@/app/[locale]/dashboard/components/editor/editor-panel-header";
import { WebsiteScaledPreview } from "@/components/website-scaled-preview";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { createWebsiteSectionPreviewDocument, SiteRenderer } from "@starter/infinite-website";
import type { WebsiteLayoutGenerationTargetV1, WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";
import {
	createWebsiteSectionLayoutPreview,
	editWebsiteSnapshot,
	listWebsiteSectionLayouts,
	readWebsiteSectionLayoutContent,
} from "@starter/infinite-website/editing";
import { Button } from "@starter/ui/components/button";
import { Radio, RadioGroup } from "@starter/ui/components/radio-group";

import { getWebsiteLayoutTargetSection, type WebsiteEditor } from "../use-website-editor";
import { useWebsiteLayoutPreview } from "./use-website-layout-preview";

type WebsiteLayoutCandidate = {
	pattern: string;
	requiresGeneration: boolean;
};

type ScheduledPreviewReference = { value: () => void };

const INITIAL_LAYOUT_CANDIDATES = 4;

const LAYOUT_CANDIDATE_CHUNK = 3;

const layoutTitleKeyByArea = {
	footer: "footerTitle",
	header: "headerTitle",
	page: "title",
} as const;

const scheduleWebsiteLayoutPreview = (callback: () => void) => {
	if (window.requestIdleCallback) {
		const handle = window.requestIdleCallback(callback, { timeout: 750 });

		return () => window.cancelIdleCallback(handle);
	}

	const handle = globalThis.setTimeout(callback, 150);

	return () => globalThis.clearTimeout(handle);
};

const createWebsiteLayoutCandidateSnapshot = ({
	baselineSnapshot,
	candidate,
	target,
}: {
	baselineSnapshot: WebsiteSnapshotV1;
	candidate: WebsiteLayoutCandidate;
	target: WebsiteLayoutGenerationTargetV1;
}) => {
	if (candidate.requiresGeneration) {
		const document = createWebsiteSectionLayoutPreview({
			document: baselineSnapshot.document,
			pattern: candidate.pattern,
			target,
		});

		return document ? { ...baselineSnapshot, document } : null;
	}

	if (target.area !== "page") {
		return null;
	}

	return editWebsiteSnapshot({
		input: {
			operation: "swap-layout",
			pageId: target.pageId,
			pattern: candidate.pattern,
			sectionId: target.sectionId,
		},
		snapshot: baselineSnapshot,
	});
};

const WebsiteLayoutOption = memo(
	({
		baselineSnapshot,
		candidate,
		currentPattern,
		index,
		locale,
		previewClassName,
		renderPreview,
		target,
	}: {
		baselineSnapshot: WebsiteSnapshotV1;
		candidate: WebsiteLayoutCandidate;
		currentPattern: string | undefined;
		index: number;
		locale: WebsiteEditor["locale"];
		previewClassName: string;
		renderPreview: boolean;
		target: WebsiteLayoutGenerationTargetV1;
	}) => {
		const t = useTranslations("website.layout");

		const preview = useMemo(() => {
			if (!renderPreview) {
				return null;
			}

			try {
				const snapshot =
					candidate.pattern === currentPattern
						? baselineSnapshot
						: createWebsiteLayoutCandidateSnapshot({ baselineSnapshot, candidate, target });

				if (!snapshot) {
					return null;
				}

				const section = getWebsiteLayoutTargetSection({ snapshot, target });

				if (!section) {
					return null;
				}

				return {
					document: createWebsiteSectionPreviewDocument({ document: snapshot.document, section, target }),
					snapshot,
				};
			} catch {
				return null;
			}
		}, [baselineSnapshot, candidate, currentPattern, renderPreview, target]);

		return (
			<label
				className='group/layout relative block shrink-0 cursor-pointer overflow-hidden rounded-xl bg-muted/52 outline-2 outline-transparent smooth-shadow-ring-sm transition-[outline-color,opacity] focus-within:outline-ring has-data-checked:outline-primary/48 has-data-unchecked:hover:opacity-88 motion-reduce:transition-none [contain-intrinsic-size:0_20rem] [content-visibility:auto]'
				data-layout-pattern={candidate.pattern}
			>
				<Radio value={candidate.pattern} variant='card' />
				<span aria-hidden='true' className='pointer-events-auto absolute inset-0 z-10' />
				<span className='sr-only'>
					{t("option", { number: index + 1 })}
					{candidate.pattern === currentPattern ? ` ${t("current")}` : ""}
				</span>
				{preview ? (
					<WebsiteScaledPreview className={previewClassName} scale='quarter'>
						<SiteRenderer
							assets={preview.snapshot.assets}
							brand={preview.snapshot.brand}
							document={preview.document}
							locale={locale}
							preview
						/>
					</WebsiteScaledPreview>
				) : (
					<div aria-hidden='true' className={previewClassName} />
				)}
			</label>
		);
	}
);

WebsiteLayoutOption.displayName = "WebsiteLayoutOption";

const previewWebsiteLayoutCandidate = ({
	candidates,
	draft,
	editor,
	generatePreview,
	pattern,
	target,
}: {
	candidates: Array<WebsiteLayoutCandidate>;
	draft: NonNullable<WebsiteEditor["draft"]>;
	editor: WebsiteEditor;
	generatePreview: (pattern: string) => Promise<void>;
	pattern: string;
	target: WebsiteLayoutGenerationTargetV1;
}) => {
	const candidate = candidates.find((item) => item.pattern === pattern);

	if (!candidate) {
		return;
	}

	if (candidate.requiresGeneration || target.area !== "page") {
		try {
			const snapshot = createWebsiteLayoutCandidateSnapshot({
				baselineSnapshot: draft.baselineSnapshot,
				candidate,
				target,
			});

			if (snapshot) {
				editor.previewDraft({ input: null, selection: pattern, snapshot });
				generatePreview(pattern);
			}
		} catch {
			return;
		}

		return;
	}

	editor.previewDraft({
		input: {
			operation: "swap-layout",
			pageId: target.pageId,
			pattern,
			sectionId: target.sectionId,
		},
		selection: pattern,
	});
};

export const WebsiteLayoutPanel = ({
	editor,
	onGenerate,
	websiteId,
}: {
	editor: WebsiteEditor;
	onGenerate: (input: {
		assetIds: Array<string>;
		baseSnapshot: WebsiteSnapshotV1;
		pattern: string;
		snapshot: WebsiteSnapshotV1;
		target: WebsiteLayoutGenerationTargetV1;
	}) => Promise<void>;
	websiteId: string;
}) => {
	const t = useTranslations("website.layout");
	const { can } = useOrganizationPermissions();
	const draft = editor.draft;
	const target = editor.layoutTarget;
	const { generatePreview, invalidatePreview } = useWebsiteLayoutPreview({ editor, websiteId });
	const baselineDocument = draft?.baselineSnapshot.document;
	const layoutOptions = useRef<HTMLDivElement>(null);

	const [previewVisibility, setPreviewVisibility] = useState<{ key: string; patterns: ReadonlySet<string> }>({
		key: "",
		patterns: new Set(),
	});

	const [candidateWindow, setCandidateWindow] = useState({ count: INITIAL_LAYOUT_CANDIDATES, key: "" });

	const candidates = useMemo(() => {
		if (editor.overlay !== "layout" || !baselineDocument || !target) {
			return [];
		}

		return listWebsiteSectionLayouts({ document: baselineDocument, target }).map(
			({ generationRequired, pattern }) => ({
				pattern,
				requiresGeneration: generationRequired || target.area !== "page",
			})
		);
	}, [baselineDocument, editor.overlay, target]);

	const candidateKey = candidates.map(({ pattern }) => pattern).join(":");
	const visiblePreviews = previewVisibility.key === candidateKey ? previewVisibility.patterns : new Set<string>();

	const visibleCandidateCount =
		candidateWindow.key === candidateKey
			? candidateWindow.count
			: Math.min(INITIAL_LAYOUT_CANDIDATES, candidates.length);

	useEffect(() => {
		if (!candidateKey || candidates.length <= INITIAL_LAYOUT_CANDIDATES) {
			return;
		}

		const cancelledReference = { value: false };
		const cancelScheduledReference: ScheduledPreviewReference = { value: () => undefined };
		const countReference = { value: INITIAL_LAYOUT_CANDIDATES };

		const revealNextCandidates = () => {
			cancelScheduledReference.value = scheduleWebsiteLayoutPreview(() => {
				if (cancelledReference.value) {
					return;
				}

				countReference.value = Math.min(candidates.length, countReference.value + LAYOUT_CANDIDATE_CHUNK);
				startTransition(() => setCandidateWindow({ count: countReference.value, key: candidateKey }));

				if (countReference.value < candidates.length) {
					revealNextCandidates();
				}
			});
		};

		revealNextCandidates();

		return () => {
			cancelledReference.value = true;
			cancelScheduledReference.value();
		};
	}, [candidateKey, candidates.length]);

	useEffect(() => {
		const root = layoutOptions.current;

		if (!root || !candidateKey || !window.IntersectionObserver) {
			return;
		}

		const cancellations = new Set<() => void>();

		const observer = new window.IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) {
						continue;
					}

					const pattern = entry.target.dataset.layoutPattern;

					if (!pattern) {
						continue;
					}

					observer.unobserve(entry.target);

					const cancel = scheduleWebsiteLayoutPreview(() => {
						startTransition(() => {
							setPreviewVisibility((current) => {
								const patterns = new Set(current.key === candidateKey ? current.patterns : []);
								patterns.add(pattern);

								return { key: candidateKey, patterns };
							});
						});
					});

					cancellations.add(cancel);
				}
			},
			{ rootMargin: "320px 0px" }
		);

		root.querySelectorAll<HTMLElement>("[data-layout-pattern]").forEach(
			(candidate, index) => index >= INITIAL_LAYOUT_CANDIDATES && observer.observe(candidate)
		);

		return () => {
			observer.disconnect();
			cancellations.forEach((cancel) => cancel());
		};
	}, [candidateKey, visibleCandidateCount]);

	if (editor.overlay !== "layout" || !draft || !target) {
		return null;
	}

	const currentSection = getWebsiteLayoutTargetSection({ snapshot: draft.baselineSnapshot, target });

	const currentPattern = currentSection?.id === target.sectionId ? currentSection.source?.pattern : undefined;

	const previewClassName =
		currentSection?.category === "hero"
			? "h-[clamp(11rem,25svh,20rem)]"
			: { footer: "aspect-[4/1]", header: "aspect-[4/1]", page: "aspect-video" }[target.area];

	const selectedPattern = draft.selection ?? "";
	const title = t(layoutTitleKeyByArea[target.area]);

	return (
		<div className='flex h-full min-h-0 flex-col'>
			<EditorPanelHeader backLabel={t("back")} onBack={editor.cancelDraft} title={title} />
			<div className='min-h-0 flex-1' ref={layoutOptions}>
				<RadioGroup
					aria-label={title}
					className='h-full overflow-y-auto'
					onValueChange={(pattern) => {
						invalidatePreview();
						previewWebsiteLayoutCandidate({ candidates, draft, editor, generatePreview, pattern, target });
					}}
					padded
					value={selectedPattern}
				>
					{candidates.slice(0, visibleCandidateCount).map((candidate, index) => (
						<WebsiteLayoutOption
							baselineSnapshot={draft.baselineSnapshot}
							candidate={candidate}
							currentPattern={currentPattern}
							index={index}
							key={candidate.pattern}
							locale={editor.locale}
							previewClassName={previewClassName}
							renderPreview={index < INITIAL_LAYOUT_CANDIDATES || visiblePreviews.has(candidate.pattern)}
							target={target}
						/>
					))}
				</RadioGroup>
			</div>
			<EditorPanelFooter
				cancelDisabled={editor.pending !== null}
				cancelLabel={t("cancel")}
				onCancel={editor.cancelDraft}
			>
				<Button
					disabled={!can("workspace.delete") || !selectedPattern || selectedPattern === currentPattern}
					loading={editor.pending?.operation === "swap-layout"}
					onClick={async () => {
						invalidatePreview();
						const candidate = candidates.find(({ pattern }) => pattern === selectedPattern);

						if (candidate?.requiresGeneration) {
							const content = readWebsiteSectionLayoutContent({
								document: draft.snapshot.document,
								target,
							});

							const localized = content?.locales[draft.snapshot.document.defaultLocale];
							const assetIds = [...new Set(localized?.assets.map(({ value }) => value) ?? [])];

							editor.closeDraft();

							await onGenerate({
								assetIds,
								baseSnapshot: draft.baselineSnapshot,
								pattern: candidate.pattern,
								snapshot: draft.snapshot,
								target,
							});

							return;
						}

						await editor.commitDraft();
					}}
					type='button'
				>
					{t("done")}
				</Button>
			</EditorPanelFooter>
		</div>
	);
};
