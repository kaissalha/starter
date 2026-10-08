"use client";

import { useState, type ReactNode } from "react";

import { ArrowLeft01Icon, Settings02Icon, Rocket01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { EditorDraftRecovery } from "@/app/[locale]/dashboard/components/editor/editor-draft-recovery";
import { EditorLanguageSelect } from "@/app/[locale]/dashboard/components/editor/editor-language-select";
import { EditorModeSwitch } from "@/app/[locale]/dashboard/components/editor/editor-mode-switch";
import { useEditorSidebar } from "@/app/[locale]/dashboard/components/editor/use-editor-sidebar";
import { WebsiteSettingsModal } from "@/app/[locale]/dashboard/components/editor/website-settings-modal";
import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Link } from "@/i18n/navigation";
import { apiClient } from "@/lib/api-client";
import {
	BlogArticle,
	blogPublishDocumentSchema,
	getBlogBodyText,
	SiteRenderer,
	type BlogPostDocument,
} from "@starter/infinite-website";
import {
	getBlogLocaleContent,
	setBlogLocaleContent,
	listBlogLocales,
	type Iso6391LanguageCode,
} from "@starter/infinite-website/contracts";
import { Button } from "@starter/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@starter/ui/components/dialog";
import { SidebarProvider, SidebarTrigger, type CSSPropertiesWithVariables } from "@starter/ui/components/sidebar";
import { Skeleton } from "@starter/ui/components/skeleton";

import { BlogCoverEditor } from "./blog-cover-editor";
import { BlogEditorSidebar } from "./blog-editor-sidebar";
import { BlogGenerationDialog } from "./blog-generation-dialog";
import { BlogPostActions } from "./blog-post-actions";
import { BlogRichTextEditor } from "./blog-rich-text-editor";
import { useBlogEditorController, type BlogEditorPost } from "./use-blog-editor-controller";
import { useBlogGenerationStream } from "./use-blog-generation-stream";

const BlogPostCanvas = ({
	body,
	cover,
	document,
	locale,
	title,
}: {
	body?: ReactNode;
	cover?: ReactNode;
	document: BlogPostDocument;
	locale: Iso6391LanguageCode;
	title?: ReactNode;
}) => {
	const t = useTranslations("blog");
	const website = useQuery(apiClient.websites.get.queryOptions());

	if (website.isPending) {
		return (
			<div aria-label={t("loading")} className='mx-auto w-full max-w-3xl space-y-6 p-6' role='status'>
				<Skeleton className='h-24 w-full' />
				<Skeleton className='h-24 w-full' />
				<Skeleton className='h-24 w-full' />
			</div>
		);
	}

	const article = (
		<main className='bg-[var(--surface-canvas)] text-[var(--foreground-primary)]'>
			<BlogArticle
				bodyContent={body}
				coverContent={cover}
				document={document}
				locale={locale}
				titleContent={title}
			/>
		</main>
	);

	return website.data?.snapshot ? (
		<SiteRenderer
			assets={website.data.snapshot.assets}
			brand={website.data.snapshot.brand}
			document={website.data.snapshot.document}
			locale={locale}
			pageContent={article}
		/>
	) : (
		article
	);
};

const BlogInlineTitle = ({
	disabled,
	onChange,
	preview,
	value,
}: {
	disabled: boolean;
	onChange: (value: string) => void;
	preview: boolean;
	value: string;
}) => {
	const t = useTranslations("blog");
	const [initialValue] = useState(value);

	return (
		<span
			aria-label={preview ? undefined : t("postTitle")}
			className='block min-h-[1em] outline-none empty:before:pointer-events-none empty:before:opacity-40 empty:before:content-[attr(data-placeholder)]'
			contentEditable={!disabled && !preview ? "plaintext-only" : false}
			data-placeholder={preview ? "" : t("postTitle")}
			onInput={(event) => {
				const title = (event.currentTarget.textContent ?? "").slice(0, 200);

				if (event.currentTarget.textContent !== title) {
					event.currentTarget.textContent = title;
				}

				onChange(title);
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter" && !event.nativeEvent.isComposing) {
					event.preventDefault();
				}
			}}
			role={preview ? undefined : "textbox"}
			suppressContentEditableWarning
			tabIndex={preview || disabled ? -1 : 0}
		>
			{initialValue}
		</span>
	);
};

const BlogEditor = ({ post }: { post: BlogEditorPost }) => {
	const { can, role } = useOrganizationPermissions();
	const sidebarProps = useEditorSidebar(`/dashboard/blog/${post.id}`);
	const dashboardLocale = useLocale();
	const t = useTranslations("blog");
	const tCommon = useTranslations("common");
	const controller = useBlogEditorController(post);
	const { languages } = controller;
	const [selectedLocale, setLocale] = useState<Iso6391LanguageCode>();

	const locale =
		selectedLocale && (!languages.document || languages.document.locales.includes(selectedLocale))
			? selectedLocale
			: (languages.document?.defaultLocale ?? "en");

	const [previewRequested, setPreview] = useState(false);
	const preview = (role !== "owner" && role !== "admin") || previewRequested;
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [generationOpen, setGenerationOpen] = useState(false);
	const [mediaOpen, setMediaOpen] = useState(false);
	const copy = getBlogLocaleContent({ document: controller.draft.document, locale });
	const disabled = !can("workspace.write") || controller.busy || languages.pending;

	const setCopy = (patch: Partial<typeof copy>) =>
		controller.changeDocument(
			setBlogLocaleContent({ content: { ...copy, ...patch }, document: controller.draft.document, locale })
		);

	const publishable = blogPublishDocumentSchema.safeParse(controller.draft.document).success;

	return (
		<SidebarProvider
			className='min-h-0'
			{...sidebarProps}
			defaultOpen={false}
			dir={dashboardLocale === "ar" ? "rtl" : "ltr"}
			purpose='details'
			style={{ "--sidebar-width-details": "23rem" } satisfies CSSPropertiesWithVariables}
		>
			<div className='flex min-w-0 flex-1 flex-col'>
				<Header
					actions={
						<>
							<span aria-live='polite' className='sr-only'>
								{t(controller.status)}
							</span>
							<div className='hidden md:contents'>
								<WebsiteSettingsModal disabled={disabled} onAddLanguage={controller.addLanguage} />
							</div>
							<EditorModeSwitch
								aria-label={t("preview")}
								checked={preview}
								disabled={!can("workspace.write")}
								onCheckedChange={(value) => {
									setMediaOpen(false);
									setPreview(value);
								}}
							/>
							{can("workspace.write") && (
								<Button
									aria-label={post.publishedDocument ? t("update") : t("publish")}
									disabled={disabled || !publishable}
									loading={controller.busy}
									onClick={() => controller.perform("publish")}
									size='sm'
								>
									<HugeiconsIcon className='scale-110' icon={Rocket01Icon} strokeWidth={1.75} />
									<span className='sr-only md:not-sr-only'>{t("publish")}</span>
								</Button>
							)}
							<BlogPostActions
								controller={controller}
								disabled={disabled}
								locale={locale}
								onDelete={() => setConfirmDelete(true)}
								onGenerate={() => setGenerationOpen(true)}
								published={Boolean(post.publishedDocument)}
							/>
						</>
					}
					center={
						!preview && (
							<SidebarTrigger
								aria-label={t("settings")}
								className='md:w-auto'
								onClick={() => setMediaOpen(false)}
								purpose='details'
								size='sm'
							>
								<HugeiconsIcon className='scale-110' icon={Settings02Icon} strokeWidth={1.75} />
								<span className='hidden md:inline'>{t("settings")}</span>
							</SidebarTrigger>
						)
					}
					centerClassName='order-none w-auto'
					className='gap-x-1.5 px-2 py-1.5 sm:px-3 sm:py-2 md:px-3'
					item={{ href: "/dashboard/blog", labelTx: "blog" }}
					leading={
						<div className='flex items-center gap-2'>
							<Button
								aria-label={t("back")}
								disabled={controller.busy}
								onClick={() => controller.leave()}
								size='icon-sm'
								variant='ghost'
							>
								<HugeiconsIcon className='scale-110' icon={ArrowLeft01Icon} strokeWidth={1.75} />
							</Button>
							<EditorLanguageSelect
								allowAddLanguage={!disabled && languages.enabled}
								defaultLocale={languages.document?.defaultLocale}
								disabled={disabled}
								locale={locale}
								locales={languages.document?.locales ?? listBlogLocales(controller.draft.document)}
								onLocaleChange={(value) => {
									setMediaOpen(false);
									setLocale(value);
								}}
							/>
						</div>
					}
				/>
				<div className='min-h-0 flex-1 overflow-hidden md:rounded-2xl'>
					<div
						className='h-full overflow-y-auto bg-background'
						data-blog-scroll
						onClickCapture={(event) => {
							if (event.target instanceof Element && !event.target.closest("[data-blog-media-trigger]")) {
								setMediaOpen(false);
							}
						}}
					>
						<EditorDraftRecovery
							error={controller.error}
							hasRecovery={controller.recoveryDraft !== null}
							onDismiss={controller.dismissRecovery}
							onDownload={controller.downloadDraft}
							onReload={() => controller.reload()}
							onRetry={controller.requestSave}
							pending={disabled}
						/>
						<BlogPostCanvas
							body={
								<BlogRichTextEditor
									body={copy.body}
									disabled={disabled}
									key={`${locale}:${controller.contentVersion}`}
									locale={locale}
									onChange={(body) => setCopy({ body })}
									preview={preview}
								/>
							}
							cover={
								preview ? undefined : (
									<BlogCoverEditor
										alt={copy.coverAlt}
										disabled={disabled}
										onEdit={() => setMediaOpen(true)}
										src={controller.draft.document.coverImage?.src}
									/>
								)
							}
							document={controller.draft.document}
							locale={locale}
							title={
								<BlogInlineTitle
									disabled={disabled}
									key={`${locale}:${controller.contentVersion}`}
									onChange={(title) => setCopy({ title })}
									preview={preview}
									value={copy.title}
								/>
							}
						/>
					</div>
				</div>
			</div>
			{!preview && (
				<BlogEditorSidebar
					controller={controller}
					copy={copy}
					disabled={disabled}
					locale={locale}
					mediaOpen={mediaOpen}
					onClose={() => setMediaOpen(false)}
					post={post}
					setCopy={setCopy}
				/>
			)}
			<BlogGenerationDialog
				busy={disabled}
				error={controller.error}
				initialTopic={copy.title}
				onGenerate={(input) => controller.perform("generate", undefined, input)}
				onOpenChange={setGenerationOpen}
				open={can("workspace.write") && generationOpen}
			/>
			<Dialog onOpenChange={setConfirmDelete} open={can("workspace.delete") && confirmDelete}>
				<DialogContent closeLabel={tCommon("close")}>
					<DialogHeader>
						<DialogTitle>{t("delete")}</DialogTitle>
						<DialogDescription>{t("deleteDescription")}</DialogDescription>
					</DialogHeader>
					<Button disabled={disabled} onClick={() => controller.perform("delete")} variant='destructive'>
						{t("delete")}
					</Button>
				</DialogContent>
			</Dialog>
		</SidebarProvider>
	);
};

const BlogGenerationPreview = ({ post }: { post: BlogEditorPost }) => {
	const t = useTranslations("blog");
	const { document, locale: streamingLocale } = useBlogGenerationStream(post);
	const [selectedLocale, setLocale] = useState<Iso6391LanguageCode>();
	const locale = selectedLocale ?? streamingLocale;

	return (
		<>
			<Header
				actions={<p role='status'>{t("writing")}</p>}
				item={{ href: "/dashboard/blog", labelTx: "blog" }}
				leading={
					<>
						<Button
							aria-label={t("back")}
							nativeButton={false}
							render={<Link aria-label={t("back")} href='/dashboard/blog' />}
							size='icon-sm'
							variant='ghost'
						>
							<HugeiconsIcon className='scale-110' icon={ArrowLeft01Icon} strokeWidth={1.75} />
						</Button>
						<EditorLanguageSelect
							locale={locale}
							locales={listBlogLocales(document)}
							onLocaleChange={setLocale}
						/>
					</>
				}
			/>
			<div aria-busy='true' className='min-h-0 flex-1 overflow-y-auto'>
				<BlogPostCanvas
					body={
						getBlogBodyText(getBlogLocaleContent({ document, locale }).body.content) ? undefined : (
							<Skeleton className='mt-8 h-32 w-full' />
						)
					}
					document={document}
					locale={locale}
					title={getBlogLocaleContent({ document, locale }).title || <Skeleton className='h-12 w-3/4' />}
				/>
			</div>
		</>
	);
};

export const BlogPostPage = ({ postId }: { postId: string }) => {
	const { organizationId, userId } = useOrganizationPermissions();
	const t = useTranslations("blog");

	const query = useQuery({
		...apiClient.blogPosts.get.queryOptions({ input: { postId } }),
		refetchInterval: (current) => (current.state.data?.generationStatus === "writing" ? 2000 : false),
	});

	if (query.isPending) {
		return (
			<>
				<Header item={{ labelTx: "blog" }} />
				<div aria-label={t("loading")} className='mx-auto w-full max-w-3xl space-y-6 p-6' role='status'>
					<Skeleton className='h-12 w-3/4' />
					<Skeleton className='aspect-video w-full' />
					<Skeleton className='h-32 w-full' />
				</div>
			</>
		);
	}

	if (!query.data) {
		return (
			<>
				<Header item={{ labelTx: "blog" }} />
				<div className='p-6' role='alert'>
					{t("loadError")}
					{query.isError && (
						<Button onClick={() => query.refetch()} variant='outline'>
							{t("retry")}
						</Button>
					)}
				</div>
			</>
		);
	}

	if (query.data.generationStatus === "writing") {
		return <BlogGenerationPreview key={query.data.generationRunId ?? query.data.id} post={query.data} />;
	}

	return (
		<BlogEditor
			key={`${userId}:${organizationId}:${query.data.id}:${query.data.publishedRevision}:${query.data.generationStatus}`}
			post={query.data}
		/>
	);
};
