"use client";

import { useTranslations } from "next-intl";

import { EditorBackButton } from "@/app/[locale]/dashboard/components/editor/editor-back-button";
import { MediaPickerContent } from "@/components/media/media-picker";
import { blogPublishDocumentSchema, type BlogPostLocaleContent } from "@starter/infinite-website";
import type { Iso6391LanguageCode } from "@starter/infinite-website/contracts";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Sidebar } from "@starter/ui/components/sidebar";
import { Textarea } from "@starter/ui/components/textarea";
import { getDirection } from "@starter/utils";

import type { useBlogEditorController, BlogEditorPost } from "./use-blog-editor-controller";

const BlogPostSettings = ({
	controller,
	copy,
	disabled,
	post,
	setCopy,
}: {
	controller: ReturnType<typeof useBlogEditorController>;
	copy: BlogPostLocaleContent;
	disabled: boolean;
	post: BlogEditorPost;
	setCopy: (patch: Partial<BlogPostLocaleContent>) => void;
}) => {
	const t = useTranslations("blog");

	return (
		<aside aria-label={t("settings")} className='grid content-start gap-5 p-5'>
			<h2 className='text-sm font-medium'>{t("settings")}</h2>
			{!blogPublishDocumentSchema.safeParse(controller.draft.document).success && (
				<p className='text-xs text-muted-foreground'>{t("bilingualRequired")}</p>
			)}
			<div className='grid gap-5'>
				<label className='grid gap-2 text-sm'>
					{t("slug")}
					<Input
						dir='ltr'
						disabled={disabled || post.firstPublishedAt !== null}
						onChange={(event) => controller.changeSlug(event.target.value)}
						value={controller.draft.slug}
					/>
				</label>
				{(
					[
						{ Control: Textarea, maxLength: 1000, name: "excerpt" },
						{ Control: Input, maxLength: 200, name: "seoTitle" },
						{ Control: Textarea, maxLength: 500, name: "seoDescription" },
						{ Control: Input, maxLength: 500, name: "coverAlt" },
					] as const
				).map(({ Control, maxLength, name }) => (
					<label className='grid content-start gap-2 text-sm' key={name}>
						{t(name)}
						<Control
							disabled={disabled}
							maxLength={maxLength}
							onChange={(event) => setCopy({ [name]: event.target.value })}
							value={copy[name]}
						/>
					</label>
				))}
			</div>
		</aside>
	);
};

export const BlogEditorSidebar = ({
	controller,
	copy,
	disabled,
	locale,
	mediaOpen,
	onClose,
	post,
	setCopy,
}: {
	controller: ReturnType<typeof useBlogEditorController>;
	copy: BlogPostLocaleContent;
	disabled: boolean;
	locale: Iso6391LanguageCode;
	mediaOpen: boolean;
	onClose: () => void;
	post: BlogEditorPost;
	setCopy: (patch: Partial<BlogPostLocaleContent>) => void;
}) => {
	const t = useTranslations("blog");
	const mediaT = useTranslations("media");

	return (
		<Sidebar aria-label={t("settings")} border='none' mobilePosition='bottom' purpose='details'>
			{mediaOpen ? (
				<div className='flex min-h-0 flex-1 flex-col gap-3 p-4'>
					<div className='flex items-center gap-2'>
						<EditorBackButton aria-label={t("settings")} onClick={() => onClose()} />
						<h2 className='text-sm font-medium'>{mediaT("title")}</h2>
					</div>
					<MediaPickerContent
						disabled={disabled}
						kind='image'
						onSelect={async (media) => {
							controller.updateDocument((current) => ({
								...current,
								coverImage: { src: media.url },
							}));
							onClose();
						}}
					/>
					{controller.draft.document.coverImage && (
						<Button
							disabled={disabled}
							onClick={() => {
								controller.updateDocument((current) => ({ ...current, coverImage: null }));
								onClose();
							}}
							variant='ghost'
						>
							{t("removeImage")}
						</Button>
					)}
				</div>
			) : (
				<div className='min-h-0 flex-1 overflow-y-auto' dir={getDirection(locale)} lang={locale}>
					<BlogPostSettings
						controller={controller}
						copy={copy}
						disabled={disabled}
						post={post}
						setCopy={setCopy}
					/>
				</div>
			)}
		</Sidebar>
	);
};
