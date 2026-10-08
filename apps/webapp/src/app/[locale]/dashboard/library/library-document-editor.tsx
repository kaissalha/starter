"use client";

import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useTranslations } from "next-intl";

import { RichTextFormattingTools } from "@/components/rich-text-formatting-tools";

export const LibraryDocumentEditor = ({
	content,
	disabled,
	onChange,
}: {
	content: string;
	disabled: boolean;
	onChange: (content: string) => void;
}) => {
	const t = useTranslations("library");

	const editor = useEditor({
		content,
		contentType: "markdown",
		editable: !disabled,
		editorProps: {
			attributes: {
				"aria-label": t("document"),
				"aria-multiline": "true",
				class: "min-h-[60dvh] outline-none [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:my-3 [&_p]:leading-relaxed [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_li]:my-1 [&_blockquote]:my-4 [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_hr]:my-6",
				dir: "auto",
				role: "textbox",
			},
		},
		extensions: [StarterKit.configure({ link: { openOnClick: false } }), Markdown],
		immediatelyRender: false,
		onUpdate: ({ editor: current }) => onChange(current.getMarkdown()),
	});

	return (
		<div className='mx-auto w-full max-w-3xl px-4 pb-16 md:px-8'>
			{!disabled && (
				<div
					aria-label={t("formatting")}
					className='sticky top-0 z-10 flex flex-wrap items-center gap-1 bg-background py-2'
					role='toolbar'
				>
					{editor && <RichTextFormattingTools disabled={disabled} editor={editor} />}
				</div>
			)}
			<EditorContent editor={editor} />
		</div>
	);
};
