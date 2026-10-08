"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";

import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";

import { useRouter } from "@/i18n/navigation";
import {
	resolveLocalizedPageSlug,
	SiteRenderer,
	withBlogNavigation,
	type Iso6391LanguageCode,
	type BlogPostSummary,
	type SiteDocument,
} from "@starter/infinite-website";
import type { WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";
import {
	SitePreviewRenderer,
	type SiteDisclosureItemControlsResolver,
	type SiteLinkElementPropsResolver,
	type SiteLinkElementTarget,
	type SiteMediaControlsResolver,
} from "@starter/infinite-website/preview";
import { Button } from "@starter/ui/components/button";
import { ScrollArea } from "@starter/ui/components/scroll-area";
import { cn } from "@starter/ui/lib/utils";

import { useWebsiteGenerationStore } from "../generation/website-generation-store";
import type { WebsiteEditor, WebsiteMode, WebsiteViewport } from "../use-website-editor";
import { useWebsiteBlogPosts } from "./use-website-blog-posts";
import { useWebsiteTextEditor } from "./use-website-text-editor";
import { WebsiteDisclosureItemControls } from "./website-disclosure-item-controls";
import { WebsiteActiveLinkEditor, type WebsiteLinkOptions } from "./website-inline-controls";
import { WebsiteInsertionGap } from "./website-insertion-gap";
import { WebsiteMediaButton } from "./website-media-panel";
import { recoverWebsitePreviewImage, revealWebsitePreviewImage } from "./website-preview-images";
import { WebsitePreviewSection, WebsiteSectionControlsProvider } from "./website-preview-section";
import { WebsiteTextAIEditor } from "./website-text-ai-editor";

type WebsiteGenerationPreviewProps = {
	additionActive: boolean;
	additionFailed: boolean;
	additionRecoverable: boolean;
	additionTarget: { index: number; pageId: string } | null;
	blocked?: boolean;
	editor: WebsiteEditor;
	insetBottom?: boolean;
	insetEnd?: boolean;
	layoutGenerationActive: boolean;
	layoutGenerationFailed: boolean;
	layoutGenerationRecoverable: boolean;
	locale?: Iso6391LanguageCode;
	mode: WebsiteMode;
	onOpenAgent: (sectionId?: string) => void;
	onOpenSectionCatalog: (input: { target: { index: number; pageId: string } }) => void;
	onRetry: () => Promise<void>;
	phase: "idle" | "starting" | "streaming" | "ready" | "failed";
	snapshot: WebsiteSnapshotV1;
	viewport: WebsiteViewport;
};

const websiteViewportClassName = {
	desktop: "max-w-none",
	mobile: "max-w-[390px]",
	tablet: "max-w-3xl",
} satisfies Record<WebsiteViewport, string>;

const WebsiteOperationAlert = ({
	action,
	description,
	onAction,
	title,
}: {
	action?: string;
	description: string;
	onAction?: () => void | Promise<void>;
	title: string;
}) => (
	<div className='sticky top-0 z-40 border-b border-border bg-background px-4 py-3 md:px-5' role='alert'>
		<div className='mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3'>
			<div>
				<p className='text-sm font-medium'>{title}</p>
				<p className='mt-0.5 text-xs text-muted-foreground'>{description}</p>
			</div>
			{action && onAction && (
				<Button onClick={onAction} size='sm' variant='outline'>
					{action}
				</Button>
			)}
		</div>
	</div>
);

const WebsiteGenerationFailureAlert = ({
	blocked,
	onReconnect,
	onRetry,
	recoverable,
}: {
	blocked: boolean;
	onReconnect: () => void;
	onRetry: () => Promise<void>;
	recoverable: boolean;
}) => {
	const t = useTranslations("website");

	if (blocked) {
		return <WebsiteOperationAlert description={t("blocked.description")} title={t("blocked.title")} />;
	}

	const state = recoverable ? "disconnected" : "failed";

	return (
		<WebsiteOperationAlert
			action={t(`${state}.action`)}
			description={t(`${state}.description`)}
			onAction={recoverable ? onReconnect : onRetry}
			title={t(`${state}.title`)}
		/>
	);
};

const WebsiteSectionAdditionFailureAlert = ({
	onReconnect,
	onRetry,
	recoverable,
	target,
}: {
	onReconnect: () => void;
	onRetry: ({ target }: { target: { index: number; pageId: string } }) => void;
	recoverable: boolean;
	target: { index: number; pageId: string } | null;
}) => {
	const t = useTranslations("website");

	const handleAction = () => {
		if (recoverable) {
			onReconnect();

			return;
		}

		if (target) {
			onRetry({ target });
		}
	};

	return (
		<WebsiteOperationAlert
			action={recoverable ? t("sectionAddition.disconnected.action") : t("sectionAddition.failed.action")}
			description={
				recoverable ? t("sectionAddition.disconnected.description") : t("sectionAddition.failed.description")
			}
			onAction={handleAction}
			title={recoverable ? t("sectionAddition.disconnected.title") : t("sectionAddition.failed.title")}
		/>
	);
};

const WebsiteLayoutGenerationFailureAlert = ({
	onReconnect,
	recoverable,
}: {
	onReconnect: () => void;
	recoverable: boolean;
}) => {
	const t = useTranslations("website.layout");
	const title = recoverable ? t("disconnected.title") : t("failed.title");
	const description = recoverable ? t("disconnected.description") : t("failed.description");

	if (!recoverable) {
		return <WebsiteOperationAlert description={description} title={title} />;
	}

	return (
		<WebsiteOperationAlert
			action={t("disconnected.action")}
			description={description}
			onAction={onReconnect}
			title={title}
		/>
	);
};

const WebsiteEditMode = ({
	blogPosts,
	document,
	editor,
	locale,
	onOpenAgent,
	onOpenSectionCatalog,
	pageSlug,
	snapshot,
}: {
	blogPosts: Array<BlogPostSummary>;
	document: SiteDocument;
	editor: WebsiteEditor;
	locale: Iso6391LanguageCode;
	onOpenAgent: WebsiteGenerationPreviewProps["onOpenAgent"];
	onOpenSectionCatalog: WebsiteGenerationPreviewProps["onOpenSectionCatalog"];
	pageSlug?: string;
	snapshot: WebsiteSnapshotV1;
}) => {
	const t = useTranslations("website.inlineEdit");
	const [linkEditor, setLinkEditor] = useState<{ anchor: HTMLElement; target: SiteLinkElementTarget } | null>(null);
	const { disabled, edit, openOverlay, pending } = editor;
	const disclosureEditor = useMemo(() => ({ disabled, edit, pending }), [disabled, edit, pending]);

	const linkOptions = useMemo<WebsiteLinkOptions>(() => {
		const sectionOptions = [
			...snapshot.document.structure.layout.header,
			...snapshot.document.structure.pages.flatMap((page) => page.sections),
			...snapshot.document.structure.layout.footer,
		].map((section) => ({ anchor: section.anchor, id: section.id, label: `#${section.anchor}` }));

		return {
			pages: snapshot.document.structure.pages.map((page) => ({
				id: page.id,
				label: resolveLocalizedPageSlug({
					content: snapshot.document.content,
					defaultLocale: snapshot.document.defaultLocale,
					locale,
					pageId: page.id,
				}),
				sections: page.sections.map((section) => ({ id: section.id, label: `#${section.anchor}` })),
			})),
			sections: sectionOptions,
		};
	}, [locale, snapshot.document]);

	const textEditor = useWebsiteTextEditor({ editor });

	const linkElementProps = useCallback<SiteLinkElementPropsResolver>(
		(target) => {
			const menuItem = target.menuItem !== undefined;

			return {
				className: cn(
					menuItem && "relative z-[60]",
					target.href === "/blog" && snapshot.document.blogNavigationHidden && "opacity-40"
				),
				"data-website-blog-link": target.href === "/blog" ? "" : undefined,
				"data-website-inline-link": "",
				"data-website-menu-item": menuItem ? "" : undefined,
				onClick: (event) => {
					event.preventDefault();
					event.stopPropagation();

					if (!disabled) {
						setLinkEditor({ anchor: event.currentTarget, target });
					}
				},
				onKeyDown: (event) => {
					if (event.key !== "Enter" || disabled) {
						return;
					}

					event.preventDefault();
					event.stopPropagation();
					setLinkEditor({ anchor: event.currentTarget, target });
				},
				title: `${menuItem ? t("menu.edit") : t("link.edit")}: ${target.href}`,
			};
		},
		[disabled, snapshot.document, t]
	);

	const mediaControls = useCallback<SiteMediaControlsResolver>(
		(target) => (
			<WebsiteMediaButton
				disabled={disabled || pending !== null}
				label={target.alt}
				openOverlay={openOverlay}
				target={target}
			/>
		),
		[disabled, openOverlay, pending]
	);

	const disclosureItemControls = useCallback<SiteDisclosureItemControlsResolver>(
		(target) => <WebsiteDisclosureItemControls editor={disclosureEditor} target={target} />,
		[disclosureEditor]
	);

	return (
		<>
			<WebsiteSectionControlsProvider
				editor={editor}
				headerMenu={{ document: snapshot.document, locale, options: linkOptions }}
				nestedEditingSectionId={linkEditor?.target.menuItem ? linkEditor.target.sectionId : undefined}
				openAgent={onOpenAgent}
				openSectionCatalog={onOpenSectionCatalog}
			>
				<div className='contents [&_[data-website-text-generating]]:shimmer [&_[data-website-text-generating]]:shimmer-color-[oklch(from_currentColor_calc(1_-_l)_0_0)] [&_[data-website-text-generating]]:shimmer-duration-1200 motion-reduce:[&_[data-website-text-generating]]:animate-none'>
					<SitePreviewRenderer
						assets={snapshot.assets}
						blogPosts={blogPosts}
						brand={snapshot.brand}
						disclosureItemControls={disclosureItemControls}
						document={document}
						insertionGapComponent={WebsiteInsertionGap}
						linkElementProps={linkElementProps}
						locale={locale}
						mediaControls={mediaControls}
						pageSlug={pageSlug}
						sectionComponent={WebsitePreviewSection}
						textElementProps={textEditor.textElementProps}
					/>
				</div>
			</WebsiteSectionControlsProvider>
			{textEditor.active &&
				!disabled &&
				(!pending || textEditor.active.generating) &&
				!editor.overlay &&
				!linkEditor && (
					<WebsiteTextAIEditor
						key={`${textEditor.active.target.nodeId}:${locale}`}
						state={{ ...textEditor, active: textEditor.active }}
					/>
				)}
			<WebsiteActiveLinkEditor
				editor={{ disabled, edit, pending }}
				onClose={() => setLinkEditor(null)}
				options={linkOptions}
				state={linkEditor}
			/>
		</>
	);
};

const websitePreviewPageNavigation = ({
	document,
	locale,
}: {
	document: SiteDocument;
	locale: Iso6391LanguageCode;
}) => {
	const pages = document.structure.pages.map((page) => ({
		home: page.home,
		id: page.id,
		slug: resolveLocalizedPageSlug({
			content: document.content,
			defaultLocale: document.defaultLocale,
			locale,
			pageId: page.id,
		}),
	}));

	return {
		pageIdByPath: new Map<string, string>(
			pages.flatMap((page) =>
				page.home
					? [["/", page.id] as const, [`/${page.slug}`, page.id] as const]
					: [[`/${page.slug}`, page.id] as const]
			)
		),
		pageSlugById: new Map(pages.map((page) => [page.id, page.slug])),
	};
};

export const WebsiteGenerationPreview = ({
	additionActive,
	additionFailed,
	additionRecoverable,
	additionTarget,
	blocked = false,
	editor,
	insetBottom = false,
	insetEnd = false,
	layoutGenerationActive,
	layoutGenerationFailed,
	layoutGenerationRecoverable,
	snapshot,
	locale = snapshot.document.defaultLocale,
	mode,
	onOpenAgent,
	onOpenSectionCatalog,
	onRetry,
	phase,
	viewport,
}: WebsiteGenerationPreviewProps) => {
	const blogPosts = useWebsiteBlogPosts({ document: snapshot.document, locale });

	const document = useMemo(() => {
		if (!blogPosts.length) {
			return snapshot.document;
		}

		return withBlogNavigation(snapshot.document, { includeHidden: mode === "edit" });
	}, [blogPosts.length, mode, snapshot.document]);

	const router = useRouter();
	const t = useTranslations("website");
	const canvas = useRef<HTMLElement>(null);

	const { navigate, pageId, reconnect, recoverable } = useWebsiteGenerationStore(
		useShallow(({ navigate, pageId, reconnect, workflow }) => ({
			navigate,
			pageId,
			reconnect,
			recoverable: workflow.phase === "disconnected",
		}))
	);

	const isGenerating = phase === "starting" || phase === "streaming";
	const initialGenerationActive = isGenerating && !additionActive && !layoutGenerationActive;

	useEffect(() => {
		const viewport = canvas.current?.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");

		if (viewport) {
			viewport.scrollTop = 0;
		}
	}, [snapshot.templateId]);

	const pageNavigation = useMemo(
		() => websitePreviewPageNavigation({ document: snapshot.document, locale }),
		[locale, snapshot.document]
	);

	const pageSlug = pageId ? pageNavigation.pageSlugById.get(pageId) : undefined;

	const handlePreviewNavigation = useCallback(
		(event: SyntheticEvent<HTMLElement>) => {
			if (!(event.target instanceof Element)) {
				return;
			}

			if (editor.overlay === "media" && !event.target.closest("[data-website-media-trigger]")) {
				editor.closeDraft();
			}

			if (event.target.closest("[data-website-inline-text]")) {
				return;
			}

			const href = event.target.closest("a")?.getAttribute("href");

			if (href === "/blog") {
				event.preventDefault();
				event.stopPropagation();

				if (!editor.disabled) {
					router.push("/dashboard/blog");
				}

				return;
			}

			if (mode === "edit" && event.target.closest("[data-website-inline-link]")) {
				event.preventDefault();

				return;
			}

			if (!href?.startsWith("/") || href.startsWith("//")) {
				return;
			}

			const [pathname] = href.split(/[?#]/u);
			const nextPageId = pathname ? pageNavigation.pageIdByPath.get(pathname) : undefined;

			if (!nextPageId) {
				return;
			}

			event.preventDefault();

			if (editor.disabled) {
				return;
			}

			navigate({ pageId: nextPageId });
		},
		[editor, mode, navigate, pageNavigation.pageIdByPath, router]
	);

	const handlePreviewImageLoad = useCallback((event: SyntheticEvent<HTMLElement>) => {
		if (event.target instanceof HTMLImageElement) {
			revealWebsitePreviewImage({ image: event.target });
		}
	}, []);

	const handlePreviewImageError = useCallback((event: SyntheticEvent<HTMLElement>) => {
		if (event.target instanceof HTMLImageElement) {
			recoverWebsitePreviewImage({ image: event.target });
		}
	}, []);

	return (
		<div aria-busy={initialGenerationActive} className='flex min-h-0 flex-1 flex-col overflow-hidden bg-background'>
			{phase === "failed" && (
				<WebsiteGenerationFailureAlert
					blocked={blocked}
					onReconnect={reconnect}
					onRetry={onRetry}
					recoverable={recoverable}
				/>
			)}
			{(additionFailed || additionRecoverable) && (
				<WebsiteSectionAdditionFailureAlert
					onReconnect={reconnect}
					onRetry={onOpenSectionCatalog}
					recoverable={additionRecoverable}
					target={additionTarget}
				/>
			)}
			{(layoutGenerationFailed || layoutGenerationRecoverable) && (
				<WebsiteLayoutGenerationFailureAlert
					onReconnect={reconnect}
					recoverable={layoutGenerationRecoverable}
				/>
			)}
			{additionActive && (
				<p aria-live='polite' className='sr-only' role='status'>
					{t("sectionAddition.progress")}
				</p>
			)}
			{layoutGenerationActive && (
				<p aria-live='polite' className='sr-only' role='status'>
					{t("layout.progress")}
				</p>
			)}

			<div
				className={cn(
					"min-h-0 flex-1 transition-[padding] duration-200 ease-linear md:ps-2 md:pb-2 motion-reduce:transition-none",
					insetEnd ? "md:pe-2" : "md:pe-0"
				)}
			>
				<main
					className={cn(
						"isolate mx-auto h-full w-full overflow-hidden rounded-none bg-background md:rounded-2xl md:border md:border-border",
						websiteViewportClassName[mode === "edit" ? "desktop" : viewport]
					)}
					data-website-viewport={mode === "edit" ? "desktop" : viewport}
					onClickCapture={handlePreviewNavigation}
					onErrorCapture={handlePreviewImageError}
					onKeyDownCapture={(event) => {
						if (event.key === "Enter") {
							handlePreviewNavigation(event);
						}
					}}
					onLoadCapture={handlePreviewImageLoad}
					ref={canvas}
				>
					<ScrollArea corners='inherit' viewportClassName='overscroll-none'>
						{initialGenerationActive && (
							<SitePreviewRenderer
								assets={snapshot.assets}
								blogPosts={blogPosts}
								brand={snapshot.brand}
								document={document}
								locale={locale}
								pageSlug={pageSlug}
								sectionComponent={WebsitePreviewSection}
							/>
						)}
						{!initialGenerationActive && mode === "edit" && (
							<WebsiteEditMode
								blogPosts={blogPosts}
								document={document}
								editor={editor}
								key={`${locale}:${pageSlug}`}
								locale={locale}
								onOpenAgent={onOpenAgent}
								onOpenSectionCatalog={onOpenSectionCatalog}
								pageSlug={pageSlug}
								snapshot={snapshot}
							/>
						)}
						{!initialGenerationActive && mode !== "edit" && (
							<SiteRenderer
								assets={snapshot.assets}
								blogPosts={blogPosts}
								brand={snapshot.brand}
								document={document}
								locale={locale}
								pageSlug={pageSlug}
							/>
						)}
						{insetBottom && <div aria-hidden='true' className='h-[56dvh]' />}
					</ScrollArea>
				</main>
			</div>
		</div>
	);
};
