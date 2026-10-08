"use client";

import { useState, useEffect, useRef } from "react";

import Image from "@tiptap/extension-image";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useTranslations } from "next-intl";

import { MediaPicker } from "@/components/media/media-picker";
import { RichTextFormattingTools } from "@/components/rich-text-formatting-tools";
import { blogBodySchema, blogUrlSchema, type BlogBody } from "@starter/infinite-website";
import type { Iso6391LanguageCode } from "@starter/infinite-website/contracts";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { useIsMobile } from "@starter/ui/hooks/use-is-mobile";
import { useIsTouchDevice } from "@starter/ui/hooks/use-is-touch-device";
import { getDirection } from "@starter/utils";

const BlogFormattingTools = ({
	disabled,
	editor,
	mediaOpen,
	onMediaOpenChange,
}: {
	disabled: boolean;
	editor: Editor;
	mediaOpen: boolean;
	onMediaOpenChange: (open: boolean) => void;
}) => {
	const t = useTranslations("blog");
	const [link, setLink] = useState("");

	return (
		<>
			<div aria-label={t("formatting")} className='flex max-w-full flex-wrap items-center gap-1' role='toolbar'>
				<RichTextFormattingTools disabled={disabled} editor={editor} />
				<Button
					aria-expanded={mediaOpen}
					disabled={disabled}
					onClick={() => onMediaOpenChange(!mediaOpen)}
					size='sm'
					variant='ghost'
				>
					{t("linkImage")}
				</Button>
			</div>
			{mediaOpen && (
				<div className='grid w-80 max-w-full gap-3 border-t p-3'>
					<div className='flex flex-wrap items-start gap-2'>
						<Input
							aria-label={t("linkUrl")}
							onChange={(event) => setLink(event.target.value)}
							placeholder='https://'
							value={link}
						/>
						<Button
							disabled={disabled || !blogUrlSchema.safeParse(link).success}
							onClick={() => editor.chain().focus().setLink({ href: link }).run()}
							size='sm'
							variant='outline'
						>
							{t("insertLink")}
						</Button>
						<Button
							disabled={disabled}
							onClick={() => editor.chain().focus().unsetLink().run()}
							size='sm'
							variant='ghost'
						>
							{t("removeLink")}
						</Button>
					</div>
					<MediaPicker
						disabled={disabled}
						kind='image'
						onSelect={(media) => editor.chain().focus().setImage({ alt: media.name, src: media.url }).run()}
					/>
				</div>
			)}
		</>
	);
};

export const BlogRichTextEditor = ({
	body,
	disabled,
	locale,
	onChange,
	preview,
}: {
	body: BlogBody;
	disabled: boolean;
	locale: Iso6391LanguageCode;
	onChange: (body: BlogBody) => void;
	preview: boolean;
}) => {
	const t = useTranslations("blog");
	const toolbar = useRef<HTMLDivElement>(null);
	const [invalid, setInvalid] = useState(false);
	const [mediaOpen, setMediaOpen] = useState(false);
	const isMobile = useIsMobile();
	const isTouchDevice = useIsTouchDevice();
	const sticky = isMobile || isTouchDevice;

	const editor = useEditor({
		content: body,
		editable: !disabled && !preview,
		editorProps: {
			attributes: {
				"aria-keyshortcuts": "Alt+F10",
				"aria-label": t("body"),
				"aria-multiline": "true",
				class: "outline-none [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:font-[family-name:var(--website-font-brand)] [&_h2]:text-3xl [&_h2]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:font-[family-name:var(--website-font-brand)] [&_h3]:text-2xl [&_h3]:font-semibold [&_p]:my-4 [&_p]:leading-relaxed [&_ul]:my-4 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:ps-6 [&_li]:my-1 [&_blockquote]:my-6 [&_blockquote]:border-s-2 [&_blockquote]:ps-6 [&_blockquote]:italic [&_a]:underline [&_a]:underline-offset-4 [&_img]:my-8 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-[var(--website-radius)]",
				role: preview ? "document" : "textbox",
			},
			handleKeyDown: (_view, event) => {
				if (event.altKey && event.key === "F10") {
					toolbar.current?.querySelector<HTMLButtonElement>("button")?.focus();

					return true;
				}

				return false;
			},
		},
		extensions: [
			StarterKit.configure({
				code: false,
				codeBlock: false,
				heading: { levels: [2, 3] },
				horizontalRule: false,
				link: { autolink: false, openOnClick: false },
				strike: false,
				underline: false,
			}),
			Image,
		],
		immediatelyRender: false,
		onUpdate: ({ editor: current }) => {
			const parsed = blogBodySchema.safeParse(current.getJSON());

			if (parsed.success) {
				onChange(parsed.data);
			}
		},
	});

	useEffect(() => {
		editor?.setEditable(!disabled && !preview, false);
	}, [disabled, editor, preview]);
	useEffect(() => {
		if (!editor) {
			return;
		}

		const key = new PluginKey("blog-document-contract");
		editor.registerPlugin(
			new Plugin({
				filterTransaction: (transaction) => {
					if (!transaction.docChanged) {
						return true;
					}

					const valid = blogBodySchema.safeParse(transaction.doc.toJSON()).success;
					setInvalid(!valid);

					return valid;
				},
				key,
			})
		);

		return () => {
			editor.unregisterPlugin(key);
		};
	}, [editor]);
	const empty = useEditorState({ editor, selector: ({ editor: current }) => current?.isEmpty ?? true });
	const scrollTarget = editor ? (document.querySelector<HTMLElement>("[data-blog-scroll]") ?? undefined) : undefined;

	return (
		<div className='relative min-w-0' dir={getDirection(locale)} lang={locale}>
			{editor &&
				!preview &&
				(sticky ? (
					<div
						className='sticky top-2 z-10 mb-4 rounded-xl bg-popover p-1 font-sans text-sm text-popover-foreground smooth-shadow-ring-md'
						ref={toolbar}
					>
						<BlogFormattingTools
							disabled={disabled}
							editor={editor}
							mediaOpen={mediaOpen}
							onMediaOpenChange={setMediaOpen}
						/>
					</div>
				) : (
					<BubbleMenu
						appendTo={() => document.body}
						className='z-60 max-w-[calc(100vw-1rem)] rounded-xl bg-popover p-1 font-sans text-sm text-popover-foreground smooth-shadow-ring-md'
						dir={getDirection(locale)}
						editor={editor}
						options={{
							flip: { boundary: scrollTarget, padding: 8 },
							offset: 8,
							onHide: () => setMediaOpen(false),
							placement: "top",
							scrollTarget,
							shift: { boundary: scrollTarget, padding: 8 },
							strategy: "fixed",
						}}
						ref={toolbar}
						shouldShow={({ editor: current, state }) =>
							!disabled &&
							(current.isFocused || Boolean(toolbar.current?.contains(document.activeElement))) &&
							(!state.selection.empty || current.isEmpty || mediaOpen)
						}
						updateDelay={0}
					>
						<BlogFormattingTools
							disabled={disabled}
							editor={editor}
							mediaOpen={mediaOpen}
							onMediaOpenChange={setMediaOpen}
						/>
					</BubbleMenu>
				))}
			{invalid && (
				<p className='p-3 text-sm text-destructive' role='alert'>
					{t("documentLimit")}
				</p>
			)}
			<EditorContent
				className={
					!disabled && !preview && empty
						? "[&_.tiptap]:min-h-32 [&_.tiptap]:cursor-text [&_.tiptap]:rounded-lg [&_.tiptap]:border [&_.tiptap]:border-dashed [&_.tiptap]:border-input [&_.tiptap]:p-4 [&_.tiptap:focus]:border-ring"
						: undefined
				}
				editor={editor}
			/>
		</div>
	);
};
